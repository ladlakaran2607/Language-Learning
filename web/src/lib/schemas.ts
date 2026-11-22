import { z } from "zod";
import { LEVELS, MISTAKE_TYPES, WORD_TYPES } from "./types";

export const WordSchema = z.object({
  de: z.string().describe("Lemma without article, e.g. 'Haus', 'gehen', 'schön'"),
  en: z.string().describe("English meaning(s), separated by '/'"),
  type: z.enum(WORD_TYPES),
  article: z.string().describe("der/die/das for nouns, empty string otherwise"),
  plural: z.string().describe("Plural without article for nouns (e.g. 'Häuser'), empty string otherwise"),
  example: z.string().describe("Short example sentence at the learner's level"),
});
export type Word = z.infer<typeof WordSchema>;

export const ErrorSchema = z.object({
  type: z.enum(MISTAKE_TYPES),
  pattern: z.string().describe("Short reusable rule label in English, e.g. 'dative after mit'"),
  wrong: z.string(),
  right: z.string(),
  explanation: z.string().describe("One short sentence in the learner's language"),
});

export const DebriefSchema = z.object({
  summary: z.string().describe("2–3 sentences on how it went, addressed to the learner"),
  fluency: z.number().describe("0–10"),
  accuracy: z.number().describe("0–10"),
  range: z.number().describe("0–10"),
  top_errors: z.array(ErrorSchema).describe("Up to 3 most important errors"),
  useful_phrases: z.array(z.object({ de: z.string(), en: z.string() })).describe("Up to 5 phrases they could have used"),
  new_words: z.array(WordSchema).describe("Up to 8 new or difficult words from the conversation"),
});
export type Debrief = z.infer<typeof DebriefSchema>;

export const LessonResultSchema = DebriefSchema.extend({
  lesson_score: z.number().describe("0–100: share of drill items the learner got right"),
  passed: z.boolean().describe("true if lesson_score >= 80"),
});
export type LessonResult = z.infer<typeof LessonResultSchema>;

const LevelEnum = z.enum(LEVELS);
export const PlacementSchema = z.object({
  summary: z.string(),
  levels: z.object({
    speaking: LevelEnum,
    listening: LevelEnum,
    reading: LevelEnum,
    writing: LevelEnum,
    grammar: LevelEnum,
  }),
  start_unit: z.number().describe("Curriculum unit number to start from"),
  strengths: z.array(z.string()),
  focus_areas: z.array(z.string()),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const WritingPromptSchema = z.object({
  prompt_de: z.string(),
  prompt_en: z.string(),
  min_words: z.number(),
  max_words: z.number(),
});
export type WritingPrompt = z.infer<typeof WritingPromptSchema>;

export const WritingFeedbackSchema = z.object({
  segments: z
    .array(
      z.object({
        text: z.string().describe("A run of the ORIGINAL text, copied exactly"),
        correction: z.string().nullable().describe("Corrected version of this run, or null if it is fine"),
        explanation: z.string().nullable(),
      }),
    )
    .describe("The original text split into consecutive runs; concatenated they reproduce it exactly"),
  corrected: z.string().describe("Clean corrected version, keeping the learner's meaning and style"),
  native: z.string().describe("How a native speaker would naturally write it"),
  feedback: z.string().describe("2–4 sentences of encouraging, specific feedback in the learner's language"),
  score: z.number().describe("0–10 for this level"),
  errors: z.array(ErrorSchema),
  new_words: z.array(WordSchema).describe("Up to 6 useful words from the native version"),
});
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>;

export const ReadingSchema = z.object({
  title: z.string(),
  text: z.string().describe("The German text, paragraphs separated by blank lines"),
  glossary: z.array(WordSchema).describe("Up to 8 words that are probably new"),
  questions: z.array(z.string()).describe("4 comprehension questions in German"),
  discussion: z.string().describe("1 open discussion question in German"),
});
export type Reading = z.infer<typeof ReadingSchema>;

export const ReadingFeedbackSchema = z.object({
  answers: z.array(z.object({ correct: z.boolean(), feedback: z.string() })),
  discussion_feedback: z.string(),
  discussion_corrected: z.string(),
  score: z.number().describe("0–10"),
  errors: z.array(ErrorSchema),
});
export type ReadingFeedback = z.infer<typeof ReadingFeedbackSchema>;

export const LookupSchema = WordSchema.extend({
  meaning_here: z.string().describe("What the word means in this exact sentence"),
});
export type Lookup = z.infer<typeof LookupSchema>;
