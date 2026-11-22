import type { Word } from "./schemas";
import { normalize, today } from "./srs";
import { uid } from "./state";
import type { AppState, Card, Mistake, MistakeType } from "./types";

/** Add new words to the deck, skipping ones already in it. Returns the state and how many were added. */
export function addWords(
  state: AppState,
  words: (Word & { box?: number; due?: string })[],
): { state: AppState; added: number } {
  const known = new Set(state.cards.filter((c) => !c.deleted).map((c) => normalize(c.de)));
  const now = Date.now();
  const fresh: Card[] = [];
  for (const w of words) {
    const de = w.de.replace(/^(der|die|das)\s+/i, "").trim();
    if (!de || known.has(normalize(de))) continue;
    known.add(normalize(de));
    fresh.push({
      id: uid(),
      de,
      en: w.en.trim(),
      type: w.type,
      article: w.type === "noun" ? w.article.trim().toLowerCase() : "",
      plural: w.type === "noun" ? w.plural.replace(/^die\s+/i, "").trim() : "",
      example: w.example.trim(),
      box: w.box ?? 1,
      due: w.due ?? today(),
      createdAt: now,
      updatedAt: now,
    });
  }
  return { state: { ...state, cards: [...state.cards, ...fresh] }, added: fresh.length };
}

const mistakeKey = (type: string, pattern: string) => `${type}:${normalize(pattern)}`;

export function recordErrors(
  state: AppState,
  errors: { type: MistakeType; pattern: string; wrong: string; right: string }[],
): AppState {
  const mistakes = [...state.mistakes];
  const now = Date.now();
  for (const e of errors) {
    const key = mistakeKey(e.type, e.pattern);
    const i = mistakes.findIndex((m) => !m.deleted && mistakeKey(m.type, m.pattern) === key);
    if (i >= 0) {
      mistakes[i] = { ...mistakes[i], count: mistakes[i].count + 1, wrong: e.wrong, right: e.right, updatedAt: now };
    } else {
      const m: Mistake = { id: uid(), type: e.type, pattern: e.pattern, wrong: e.wrong, right: e.right, count: 1, updatedAt: now };
      mistakes.push(m);
    }
  }
  return { ...state, mistakes };
}

export function addLog(state: AppState, mode: string, summary: string, score?: number): AppState {
  const entry = { id: uid(), date: today(), mode, summary, score, updatedAt: Date.now() };
  return { ...state, log: [...state.log, entry] };
}
