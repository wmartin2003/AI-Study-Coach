import { generateStructured } from "./anthropic";

export async function generateTopicOutline(courseName: string, level: string): Promise<string[]> {
  const result = await generateStructured<{ topics: string[] }>({
    system:
      "You design study curricula. Given a course name and level, break it into 4-6 major topic areas a student would progress through, ordered from foundational to advanced. Keep each topic name short (2-5 words).",
    prompt: `Course: ${courseName}\nLevel: ${level}\n\nList the topic areas for this course.`,
    toolName: "outline_topics",
    toolDescription: "Return an ordered list of topic area names for a course.",
    inputSchema: {
      type: "object",
      properties: {
        topics: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
      },
      required: ["topics"],
    },
  });

  return result.topics;
}
