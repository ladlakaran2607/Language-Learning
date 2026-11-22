export const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];

export const SKILLS = ["speaking", "listening", "reading", "writing", "grammar"] as const;
export type Skill = (typeof SKILLS)[number];

export const MISTAKE_TYPES = [
  "gender",
  "case",
  "word_order",
  "verb_form",
  "tense",
  "preposition",
  "adjective_ending",
  "spelling",
  "vocabulary",
  "other",
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  gender: "Gender & articles",
  case: "Case",
  word_order: "Word order",
  verb_form: "Verb forms",
  tense: "Tense",
  preposition: "Prepositions",
  adjective_ending: "Adjective endings",
  spelling: "Spelling & capitals",
  vocabulary: "Word choice",
  other: "Other",
};

export const WORD_TYPES = ["noun", "verb", "adj", "adv", "phrase", "other"] as const;
export type WordType = (typeof WORD_TYPES)[number];

/** Every synced record has an id and updatedAt so two devices can be merged. */
export interface Synced {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface Profile {
  placed: boolean;
  levels: Record<Skill, Level>;
  nativeLanguage: string;
  goal: string;
  interests: string;
  minutesPerDay: number;
  currentUnit: number;
  unitsDone: number[];
  updatedAt: number;
}

export interface Card extends Synced {
  de: string;
  en: string;
  type: WordType;
  article: string; // der/die/das for nouns, "" otherwise
  plural: string; // plural form without article, "" if none/unknown
  example: string;
  box: number; // Leitner box 1–5
  due: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Mistake extends Synced {
  type: MistakeType;
  pattern: string; // short rule label, e.g. "dative after 'mit'"
  wrong: string;
  right: string;
  count: number;
}

export interface LogEntry extends Synced {
  date: string; // YYYY-MM-DD
  mode: string;
  summary: string;
  score?: number; // 0–10
}

export interface JournalEntry extends Synced {
  date: string;
  prompt: string;
  original: string;
  segments: { text: string; correction: string | null; explanation: string | null }[];
  corrected: string;
  native: string;
  feedback: string;
  score: number;
}

export type ChatMode = "chat" | "lesson" | "placement";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  hidden?: boolean; // kick-off prompts the learner doesn't need to see
}

export interface Conversation extends Synced {
  mode: ChatMode;
  title: string;
  unit?: number;
  system: string; // frozen at start so the prompt stays cacheable
  messages: ChatMessage[];
  startedAt: number;
  finished: boolean;
  debrief?: unknown;
}

export interface AppState {
  version: 1;
  profile: Profile;
  cards: Card[];
  mistakes: Mistake[];
  log: LogEntry[];
  journal: JournalEntry[];
  conversations: Conversation[];
}

/** Device-only settings. Never synced: they hold secrets. */
export interface Settings {
  apiKey: string;
  model: string;
  githubToken: string;
  gistId: string;
  autoSpeak: boolean;
  speechRate: number;
  voiceName: string;
  lastSync: number;
  lastSyncError: string;
}
