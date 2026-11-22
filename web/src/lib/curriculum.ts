// Single source of truth: the same curriculum file the /deutsch Claude Code skill uses.
import raw from "../../../.claude/skills/deutsch/curriculum.md?raw";

export interface Unit {
  n: number;
  level: string; // A1, A2, B1, B2
  title: string;
  theme: string;
}

export function parseCurriculum(md: string): Unit[] {
  const units: Unit[] = [];
  let level = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+([ABC][12])\b/);
    if (h) {
      level = h[1];
      continue;
    }
    const m = line.match(/^(\d+)\.\s+(.+?)(?:\s+\[(.+)\])?\s*$/);
    if (m && level) units.push({ n: Number(m[1]), level, title: m[2].replace(/\*/g, ""), theme: m[3] ?? "" });
  }
  return units;
}

export const CURRICULUM = parseCurriculum(raw);

export const unitByNumber = (n: number) => CURRICULUM.find((u) => u.n === n);

export function levelForUnit(n: number): string {
  return unitByNumber(n)?.level ?? "A1";
}

/** First unit of a CEFR level, used after placement. */
export function firstUnitOf(level: string): number {
  return CURRICULUM.find((u) => u.level === level)?.n ?? 1;
}
