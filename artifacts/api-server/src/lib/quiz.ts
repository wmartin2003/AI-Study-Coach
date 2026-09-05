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
  courseName: string;
  topicName: string;
  count: number;
  level: string;
}): Promise<GeneratedQuestion[]> {
  const result = await generateStructured<{ questions: GeneratedQuestion[] }>({
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
