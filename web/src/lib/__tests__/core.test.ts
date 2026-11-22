import { describe, expect, it } from "vitest";
import { addWords, recordErrors } from "../actions";
import { CURRICULUM, parseCurriculum } from "../curriculum";
import { addDays, checkEnglish, checkGerman, dueCards, schedule, streak } from "../srs";
import { emptyState, mergeStates } from "../state";
import { cardsToTsv, tsvToCards } from "../tsv";
import type { Card } from "../types";

const card = (over: Partial<Card> = {}): Card => ({
  id: "c1", de: "Haus", en: "house", type: "noun", article: "das", plural: "Häuser", example: "", box: 1,
  due: "2026-11-22", createdAt: 0, updatedAt: 0, ...over,
});

describe("curriculum", () => {
  it("parses all 60 units with levels and themes from the skill's curriculum.md", () => {
    expect(CURRICULUM).toHaveLength(60);
    expect(CURRICULUM[0]).toMatchObject({ n: 1, level: "A1", theme: "greetings" });
    expect(CURRICULUM.find((u) => u.n === 22)?.level).toBe("A2");
    expect(CURRICULUM.find((u) => u.n === 36)?.level).toBe("B1");
    expect(CURRICULUM.find((u) => u.n === 60)?.level).toBe("B2");
  });
  it("handles units without a theme", () => {
    expect(parseCurriculum("## A1: x\n1. Something")).toEqual([{ n: 1, level: "A1", title: "Something", theme: "" }]);
  });
});

describe("leitner scheduling", () => {
  it("moves up a box on correct and schedules by the new box", () => {
    const c = schedule(card({ box: 1 }), "correct", "2026-11-22");
    expect(c.box).toBe(2);
    expect(c.due).toBe("2026-11-25");
  });
  it("caps at box 5 with a 35-day interval", () => {
    const c = schedule(card({ box: 5 }), "correct", "2026-11-22");
    expect(c).toMatchObject({ box: 5, due: addDays("2026-11-22", 35) });
  });
  it("sends wrong answers back to box 1, due tomorrow", () => {
    expect(schedule(card({ box: 4 }), "wrong", "2026-11-22")).toMatchObject({ box: 1, due: "2026-11-23" });
  });
  it("keeps the box on partial", () => {
    expect(schedule(card({ box: 3 }), "partial", "2026-11-22")).toMatchObject({ box: 3, due: "2026-11-23" });
  });
  it("crosses month boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("lists due cards, skipping deleted and future ones", () => {
    const cards = [card({ id: "a" }), card({ id: "b", due: "2026-12-01" }), card({ id: "c", deleted: true })];
    expect(dueCards(cards, "2026-11-22").map((c) => c.id)).toEqual(["a"]);
  });
});

describe("answer checking", () => {
  it("requires the right article for nouns", () => {
    expect(checkGerman(card(), "das Haus").grade).toBe("correct");
    expect(checkGerman(card(), "der Haus").grade).toBe("wrong");
    expect(checkGerman(card(), "Haus").grade).toBe("wrong");
  });
  it("accepts ae/oe/ue and ss spellings and checks the plural", () => {
    expect(checkGerman(card(), "das Haus", "Haeuser").grade).toBe("correct");
    expect(checkGerman(card(), "das Haus", "die Häuser").grade).toBe("correct");
    expect(checkGerman(card(), "das Haus", "Hause").grade).toBe("partial");
    expect(checkGerman(card({ de: "Straße", article: "die", plural: "" }), "die Strasse").grade).toBe("correct");
  });
  it("tips on lowercase nouns", () => {
    expect(checkGerman(card(), "das haus").notes.join()).toMatch(/capitalised/);
  });
  it("accepts any listed English meaning with or without 'to'", () => {
    const verb = card({ de: "gehen", en: "to go / to walk", type: "verb", article: "", plural: "" });
    expect(checkEnglish(verb, "walk").grade).toBe("correct");
    expect(checkEnglish(verb, "to go").grade).toBe("correct");
    expect(checkEnglish(verb, "run").grade).toBe("wrong");
    expect(checkGerman(verb, "Gehen!").grade).toBe("correct");
  });
});

describe("streak", () => {
  const log = (date: string) => ({ id: date, updatedAt: 0, date, mode: "x", summary: "" });
  it("counts consecutive days ending today or yesterday", () => {
    expect(streak([log("2026-11-20"), log("2026-11-21"), log("2026-11-22")], "2026-11-22")).toBe(3);
    expect(streak([log("2026-11-20"), log("2026-11-21")], "2026-11-22")).toBe(2);
    expect(streak([log("2026-11-19")], "2026-11-22")).toBe(0);
  });
});

describe("deck and mistakes", () => {
  it("adds words without duplicates and strips articles", () => {
    const w = { de: "der Tisch", en: "table", type: "noun" as const, article: "Der", plural: "die Tische", example: "" };
    const r1 = addWords(emptyState(), [w, w]);
    expect(r1.added).toBe(1);
    expect(r1.state.cards[0]).toMatchObject({ de: "Tisch", article: "der", plural: "Tische", box: 1 });
    expect(addWords(r1.state, [w]).added).toBe(0);
  });
  it("counts recurring mistakes by type and pattern", () => {
    const e = { type: "case" as const, pattern: "Dative after mit", wrong: "mit der Bus", right: "mit dem Bus" };
    const s = recordErrors(recordErrors(emptyState(), [e]), [{ ...e, pattern: "dative after mit" }]);
    expect(s.mistakes).toHaveLength(1);
    expect(s.mistakes[0].count).toBe(2);
  });
});

describe("sync merge", () => {
  it("keeps the newest version of each record from both devices", () => {
    const a = { ...emptyState(), cards: [card({ id: "x", box: 2, updatedAt: 1 }), card({ id: "only-a", updatedAt: 1 })] };
    const b = { ...emptyState(), cards: [card({ id: "x", box: 4, updatedAt: 2 }), card({ id: "only-b", updatedAt: 1 })] };
    const m = mergeStates(a, b);
    expect(m.cards).toHaveLength(3);
    expect(m.cards.find((c) => c.id === "x")?.box).toBe(4);
    expect(mergeStates(b, a).cards.find((c) => c.id === "x")?.box).toBe(4);
  });
  it("propagates deletions and picks the newer profile", () => {
    const a = { ...emptyState(), cards: [card({ id: "x", updatedAt: 1 })] };
    const b = { ...emptyState(), cards: [card({ id: "x", deleted: true, updatedAt: 5 })], profile: { ...emptyState().profile, currentUnit: 7, updatedAt: 9 } };
    const m = mergeStates(a, b);
    expect(m.cards[0].deleted).toBe(true);
    expect(m.profile.currentUnit).toBe(7);
  });
});

describe("tsv", () => {
  it("round-trips the german/vocab.tsv format", () => {
    const tsv = cardsToTsv([card({ example: "Das Haus ist alt.", box: 3, due: "2026-12-01" })]);
    expect(tsv.split("\n")[0]).toBe("de\ten\ttype\tarticle\tplural\texample\tbox\tdue");
    expect(tsvToCards(tsv)[0]).toMatchObject({ de: "Haus", article: "das", plural: "Häuser", box: 3, due: "2026-12-01" });
  });
  it("reads the skill's empty deck and rows with blank columns", () => {
    expect(tsvToCards("de\ten\ttype\tarticle\tplural\texample\tbox\tdue\n")).toEqual([]);
    expect(tsvToCards("de\ten\ttype\tarticle\tplural\texample\tbox\tdue\ngehen\tto go\tverb\t\t\t\t1\t2026-11-22\n")[0]).toMatchObject({ de: "gehen", type: "verb", article: "" });
  });
});
