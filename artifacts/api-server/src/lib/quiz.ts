import { generateStructured } from "./anthropic";

export type GeneratedQuestion = {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: "warm-up" | "core" | "stretch";
};

/**
 * Fisher-Yates shuffle. The model tends to place the correct option in
 * similar slots across questions, so we shuffle server-side before storing —
 * grading compares against `correctAnswer` by text, not position, so this
 * never risks a mismatch between the displayed order and the stored answer.
 */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function generateQuizQuestions(options: {
  userId: string;
  courseName: string;
  topicName: string;
  count: number;
  level: string;
}): Promise<GeneratedQuestion[]> {
  const result = await generateStructured<{ questions: GeneratedQuestion[] }>({
    userId: options.userId,
    feature: "quiz",
    system:
      "You are an assessment writer for an adaptive study-coach app. Write clear, unambiguous multiple-choice questions that test real understanding, not trivia. Each question needs exactly 4 options with exactly one correct answer. Vary difficulty across the set: start with warm-up questions and progress toward stretch questions that require applying the concept, not just recalling it.",
    prompt: `Course: ${options.courseName}\nTopic: ${options.topicName}\nStudent level: ${options.level}\n\nWrite ${options.count} multiple-choice questions on this topic.`,
    toolName: "write_quiz_questions",
    toolDescription: "Return a set of multiple-choice quiz questions.",
    maxTokens: 4096,
    inputSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionText: { type: "string" },
              options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
              correctAnswer: { type: "string", description: "Must exactly match one of the options." },
              explanation: { type: "string", description: "Why the correct answer is right, in 1-2 sentences." },
              difficulty: { type: "string", enum: ["warm-up", "core", "stretch"] },
            },
            required: ["questionText", "options", "correctAnswer", "explanation", "difficulty"],
          },
        },
      },
      required: ["questions"],
    },
  });

  return result.questions.map((question) => ({ ...question, options: shuffle(question.options) }));
}

export type TopicAllocation = { name: string; questionCount: number };

/**
 * Splits `count` questions across `topics` for an "overall" (course-wide)
 * quiz. Balanced mode spreads them as evenly as possible; weak-spots mode
 * weights the split toward lower-mastery topics — using the student's own
 * mastery data to decide *how many* questions a topic gets, rather than
 * hoping the model infers that from a vague instruction. A largest-remainder
 * distribution keeps the total exactly `count` regardless of rounding.
 */
export function allocateTopics(
  topics: { name: string; masteryScore: number }[],
  count: number,
  focus: "balanced" | "weak-spots",
): TopicAllocation[] {
  if (topics.length === 0 || count <= 0) return [];

  const weights =
    focus === "weak-spots"
      ? topics.map((t) => Math.max(1, Math.round(((100 - t.masteryScore) / 100) * 4) + 1))
      : topics.map(() => 1);

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / totalWeight) * count);
  const base = raw.map(Math.floor);
  let remaining = count - base.reduce((a, b) => a + b, 0);

  const byRemainder = raw
    .map((value, index) => ({ index, fraction: value - base[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remaining && i < byRemainder.length; i++) base[byRemainder[i].index]++;

  return topics.map((topic, index) => ({ name: topic.name, questionCount: base[index] })).filter((a) => a.questionCount > 0);
}

export type OverallQuestion = GeneratedQuestion & { topicName: string };

/**
 * Generates an overall (multi-topic) quiz in a single model call. The exact
 * per-topic question counts are decided server-side by `allocateTopics` and
 * passed in as an instruction the model must follow exactly; each returned
 * question is tagged with the topic it covers via a JSON-schema enum, so the
 * tag is always one of the course's real topic names — never something the
 * model invented.
 */
export async function generateOverallQuizQuestions(options: {
  userId: string;
  courseName: string;
  level: string;
  allocations: TopicAllocation[];
}): Promise<OverallQuestion[]> {
  const plan = options.allocations.map((a) => `${a.questionCount} question(s) on "${a.name}"`).join("; ");
  const totalCount = options.allocations.reduce((sum, a) => sum + a.questionCount, 0);

  const result = await generateStructured<{ questions: OverallQuestion[] }>({
    userId: options.userId,
    feature: "quiz",
    system:
      "You are an assessment writer for an adaptive study-coach app, building a course-wide review quiz that spans multiple topics. Follow the requested per-topic question count exactly. Each question needs exactly 4 options with exactly one correct answer, and must be tagged with the exact topic name it covers. Vary difficulty across the set overall.",
    prompt: `Course: ${options.courseName}\nStudent level: ${options.level}\n\nWrite a ${totalCount}-question review quiz with this exact topic distribution: ${plan}.`,
    toolName: "write_overall_quiz",
    toolDescription: "Return a set of multiple-choice quiz questions spanning several topics.",
    maxTokens: 4096,
    inputSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topicName: { type: "string", enum: options.allocations.map((a) => a.name) },
              questionText: { type: "string" },
              options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
              correctAnswer: { type: "string", description: "Must exactly match one of the options." },
              explanation: { type: "string", description: "Why the correct answer is right, in 1-2 sentences." },
              difficulty: { type: "string", enum: ["warm-up", "core", "stretch"] },
            },
            required: ["topicName", "questionText", "options", "correctAnswer", "explanation", "difficulty"],
          },
        },
      },
      required: ["questions"],
    },
  });

  return result.questions.map((question) => ({ ...question, options: shuffle(question.options) }));
}
