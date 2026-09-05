import { generateStructured } from "./anthropic";

export type ExtractedTopic = { name: string; confidence: "high" | "medium" | "low" };
export type ExtractedEvent = {
  type: "exam" | "midterm" | "final" | "assignment" | "quiz" | "project" | "other";
  title: string;
  eventDate: string | null;
  confidence: "high" | "medium" | "low";
};
export type SyllabusExtraction = {
  confidence: "high" | "medium" | "low";
  courseName: string | null;
  courseCode: string | null;
  instructor: string | null;
  term: string | null;
  topics: ExtractedTopic[];
  events: ExtractedEvent[];
};

/**
 * Reads a syllabus's extracted text and pulls out structured course info.
 * Every item carries its own confidence rather than one blanket score, since
 * a syllabus can state the exam date plainly while only vaguely implying
 * weekly topics — the review screen needs to distinguish those, not present
 * a guess as a fact.
 */
export async function extractSyllabusInfo(text: string): Promise<SyllabusExtraction> {
  return generateStructured<SyllabusExtraction>({
    system:
      "You extract structured information from course syllabi for a study-coach app. Only report information that is actually present in the text — never invent a course code, instructor name, or date that isn't there. For each topic and event, set confidence to \"high\" only when it's stated explicitly and unambiguously (e.g. an exact date, an explicit topic list); use \"medium\" when it's a reasonable reading of the text; use \"low\" when you're inferring loosely. If a date isn't given a specific calendar date (e.g. only \"Week 6\"), set eventDate to null rather than guessing a date. If the document isn't a syllabus at all, return empty topics/events arrays and confidence \"low\".",
    prompt: `Syllabus text:\n\n${text.slice(0, 12000)}`,
    toolName: "extract_syllabus",
    toolDescription: "Return structured course information extracted from a syllabus.",
    maxTokens: 3072,
    inputSchema: {
      type: "object",
      properties: {
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "Overall confidence this document is a syllabus and the extraction is reliable." },
        courseName: { type: ["string", "null"] },
        courseCode: { type: ["string", "null"] },
        instructor: { type: ["string", "null"] },
        term: { type: ["string", "null"] },
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["name", "confidence"],
          },
        },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["exam", "midterm", "final", "assignment", "quiz", "project", "other"] },
              title: { type: "string" },
              eventDate: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD), or null if no specific date is given." },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["type", "title", "eventDate", "confidence"],
          },
        },
      },
      required: ["confidence", "courseName", "courseCode", "instructor", "term", "topics", "events"],
    },
  });
}
