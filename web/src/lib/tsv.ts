import { today } from "./srs";
import { uid } from "./state";
import { WORD_TYPES, type Card, type WordType } from "./types";

// Same format as german/vocab.tsv used by the /deutsch Claude Code skill.
const HEADER = ["de", "en", "type", "article", "plural", "example", "box", "due"];

export function cardsToTsv(cards: Card[]): string {
  const clean = (s: string) => s.replace(/[\t\n]/g, " ");
  const rows = cards
    .filter((c) => !c.deleted)
    .map((c) => [c.de, c.en, c.type, c.article, c.plural, c.example, String(c.box), c.due].map(clean).join("\t"));
  return [HEADER.join("\t"), ...rows].join("\n") + "\n";
}

export function tsvToCards(tsv: string): Card[] {
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const hasHeader = first.includes("de") && first.includes("en");
  const cols = hasHeader ? first : HEADER;
  const idx = (name: string) => cols.indexOf(name);
  const now = Date.now();
  return (hasHeader ? lines.slice(1) : lines).flatMap((line) => {
    const f = line.split("\t");
    const get = (name: string) => (idx(name) >= 0 ? (f[idx(name)] ?? "").trim() : "");
    const de = get("de");
    const en = get("en");
    if (!de || !en) return [];
    const type = (WORD_TYPES as readonly string[]).includes(get("type")) ? (get("type") as WordType) : "other";
    const box = Math.min(5, Math.max(1, Number(get("box")) || 1));
    const due = /^\d{4}-\d{2}-\d{2}$/.test(get("due")) ? get("due") : today();
    return [{ id: uid(), de, en, type, article: get("article"), plural: get("plural"), example: get("example"), box, due, createdAt: now, updatedAt: now }];
  });
}
