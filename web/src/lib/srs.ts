import type { Card, LogEntry } from "./types";

/** Leitner intervals in days for boxes 1–5 (same as the /deutsch skill). */
export const INTERVALS = [1, 3, 7, 16, 35];

export function today(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return today(new Date(y, m - 1, d + days));
}

export type Grade = "correct" | "partial" | "wrong";

export function schedule(card: Card, grade: Grade, on = today()): Card {
  let box = card.box;
  let due: string;
  if (grade === "correct") {
    box = Math.min(box + 1, 5);
    due = addDays(on, INTERVALS[box - 1]);
  } else if (grade === "partial") {
    due = addDays(on, 1);
  } else {
    box = 1;
    due = addDays(on, 1);
  }
  return { ...card, box, due, updatedAt: Date.now() };
}

export const isDue = (c: Card, on = today()) => !c.deleted && c.due <= on;

export function dueCards(cards: Card[], on = today()): Card[] {
  return cards.filter((c) => isDue(c, on)).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box));
}

/** Lenient comparison: case, punctuation, ß/ss and ae/oe/ue spellings are accepted. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/\(.*?\)/g, " ")
    .replace(/[.,!?;:"'„“”‚‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTICLES = ["der", "die", "das"];

export interface CheckResult {
  grade: Grade;
  notes: string[];
}

/** English → German. Nouns need the right article; the plural is checked when asked. */
export function checkGerman(card: Card, answer: string, pluralAnswer?: string): CheckResult {
  const notes: string[] = [];
  const ans = normalize(answer);
  const target = normalize(card.de);
  const words = ans.split(" ");

  if (card.type === "noun" && card.article) {
    const art = ARTICLES.includes(words[0]) ? words[0] : "";
    const noun = art ? words.slice(1).join(" ") : ans;
    const nounOk = noun === target || noun === normalize(card.de.replace(/^(der|die|das)\s+/i, ""));
    const artOk = art === card.article.toLowerCase();
    if (!nounOk) return { grade: "wrong", notes: [`It's ${card.article} ${card.de}.`] };
    if (!art) return { grade: "wrong", notes: [`Don't forget the article: ${card.article} ${card.de}.`] };
    if (!artOk) return { grade: "wrong", notes: [`Right word, wrong article: ${card.article}, not ${art}.`] };
    if (pluralAnswer !== undefined && card.plural) {
      const p = normalize(pluralAnswer).replace(/^die\s+/, "");
      if (p !== normalize(card.plural)) {
        notes.push(`Plural: die ${card.plural}.`);
        return { grade: "partial", notes };
      }
    }
    const typedNoun = answer.trim().split(/\s+/).pop() ?? "";
    if (typedNoun && typedNoun[0] === typedNoun[0].toLowerCase()) {
      notes.push("Tip: German nouns are always capitalised.");
    }
    return { grade: "correct", notes };
  }

  const alternatives = card.de.split(/[\/;,]/).map(normalize).filter(Boolean);
  if (alternatives.includes(ans) || ans === target) return { grade: "correct", notes };
  return { grade: "wrong", notes: [`It's ${card.de}.`] };
}

/** German → English. Accepts any of the listed meanings, with or without "to"/"a"/"the". */
export function checkEnglish(card: Card, answer: string): CheckResult {
  const strip = (s: string) => normalize(s).replace(/^(to|a|an|the)\s+/, "");
  const ans = strip(answer);
  const meanings = card.en.split(/[\/;,]/).map(strip).filter(Boolean);
  if (ans && meanings.some((m) => m === ans)) return { grade: "correct", notes: [] };
  return { grade: "wrong", notes: [`It means "${card.en}".`] };
}

/** Consecutive days with at least one session, ending today or yesterday. */
export function streak(log: LogEntry[], on = today()): number {
  const days = new Set(log.filter((l) => !l.deleted).map((l) => l.date));
  let cursor = days.has(on) ? on : addDays(on, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
