import { CURRICULUM, unitByNumber, type Unit } from "./curriculum";
import { live } from "./state";
import type { AppState, Level } from "./types";

export function overallLevel(state: AppState): Level {
  const order = ["A0", "A1", "A2", "B1", "B2", "C1"];
  const levels = Object.values(state.profile.levels);
  const avg = levels.reduce((s, l) => s + order.indexOf(l), 0) / levels.length;
  return order[Math.round(avg)] as Level;
}

/** A0 learners get A1-level material. */
export const teachingLevel = (l: Level) => (l === "A0" ? "A1" : l);

function learnerContext(state: AppState): string {
  const p = state.profile;
  const top = live(state.mistakes)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((m) => `- ${m.pattern} (x${m.count}), e.g. "${m.wrong}" → "${m.right}"`)
    .join("\n");
  return `## Learner
- Native/explanation language: ${p.nativeLanguage}
- Goal: ${p.goal}
- Levels: ${Object.entries(p.levels).map(([k, v]) => `${k} ${v}`).join(", ")}
- Interests: ${p.interests || "not given yet"}
- Current curriculum unit: ${p.currentUnit}
- Recurring mistakes to recycle:
${top || "- none recorded yet"}`;
}

const PRINCIPLES = `## Teaching principles
- You are a patient but demanding German tutor inside a learning app. The learner's goal is B2.
- Output beats recognition: make the learner produce German.
- Every noun comes with its article (and plural when introducing it).
- i+1: mostly familiar language plus a little new.
- Recycle the learner's recurring mistakes in examples and questions.
- At A0–A2 explain in the learner's native language; from B1 explain more and more in simple German.
- Teach Standard German. Mention common colloquial or regional variants only when relevant.
- Be encouraging but honest. Never praise a wrong answer.
- Formatting: short paragraphs, Markdown allowed (bold, lists, small tables). No headings in chat turns.`;

const LEVEL_STYLE: Record<string, string> = {
  A1: "Very short, simple sentences. Present tense and Perfekt only. High-frequency words. Speak slowly.",
  A2: "Short sentences, everyday vocabulary, present, Perfekt, simple weil/dass clauses.",
  B1: "Natural speed, everyday topics in depth, subordinate clauses, Präteritum of common verbs.",
  B2: "Natural, idiomatic German with colloquial forms, opinions and abstract topics.",
  C1: "Fully natural, nuanced German, idioms, register shifts.",
};

export function chatSystem(state: AppState, topic: string): string {
  const level = teachingLevel(overallLevel(state));
  return `${PRINCIPLES}

${learnerContext(state)}

## Mode: conversation practice
Role-play this situation with the learner: **${topic}**.
- Write ONLY in German, adapted to level ${level}: ${LEVEL_STYLE[level]}
- Keep each turn to 1–3 sentences and end with a question so the learner talks most.
- Corrections: if the learner's last message had real errors, START your reply with exactly one line:
  ✏️ <corrected sentence> — <why, 3–8 words in ${state.profile.nativeLanguage}>
  then a blank line, then your in-character reply. If there were no errors, no correction line. Don't correct tiny slips that don't matter.
- If the learner writes in ${state.profile.nativeLanguage} or English, show them how to say it in German (as a correction line), then continue.
- Stay in the role-play. Start by setting the scene in one short sentence and asking the first question.`;
}

export function lessonSystem(state: AppState, unit: Unit): string {
  const level = teachingLevel(overallLevel(state));
  const next = CURRICULUM.find((u) => u.n === unit.n + 1);
  return `${PRINCIPLES}

${learnerContext(state)}

## Mode: grammar lesson
Unit ${unit.n} (${unit.level}): **${unit.title}**. Vocabulary theme: ${unit.theme || "everyday life"}.
${next ? `(Next unit will be: ${next.title}.)` : ""}
Teach it interactively, one step per message:
1. Hook: 3–4 example sentences in context. Ask the learner what pattern they notice.
2. Rule: short explanation in ${unit.level <= "A2" ? state.profile.nativeLanguage : "simple German with key terms translated"}, with a small table if it helps. Compare with English when useful.
3. Drill: 8–10 items, ONE item per message, from recognition to production. After each answer, mark it ✅ or ❌, give the correct form and a one-line reason, then give the next item. Number the items (1/10, 2/10…).
4. Use it: a short 4–6 exchange mini-dialogue that forces the structure.
5. Finish: say "Lektion fertig!" and summarise the rule in 2–3 bullet points. Tell the learner to press "Finish & save".
Adapt to level ${level}. Never dump all steps at once.`;
}

export function placementSystem(state: AppState): string {
  return `${PRINCIPLES}

## Mode: placement test
Find the learner's CEFR level (A0–B2) per skill. Native language: ${state.profile.nativeLanguage}.
1. First message: greet them briefly in ${state.profile.nativeLanguage}, explain the test takes ~10 minutes and it's fine to answer "I don't know". Ask: why they're learning German, any prior study, interests.
2. Then ask ONE question per message (about 12 total) rising from A1 to B2: articles and gender, present-tense conjugation, V2 word order, accusative vs dative, Perfekt, subordinate clause verb-final, adjective endings, Konjunktiv II, passive. Include 2 short reading items (a German sentence or two + a question) and 1 short writing prompt.
3. Stop rising after 3 misses in a row. Don't explain answers during the test; just say "Danke!" and move on.
4. When done, say "Test fertig!" and tell the learner to press "Finish & save" to see their result.`;
}

export const kickoff: Record<string, string> = {
  chat: "Let's start the conversation.",
  lesson: "Let's start the lesson.",
  placement: "Let's start the placement test.",
};

export function debriefInstruction(mode: string): string {
  if (mode === "placement")
    return "The placement test is over. Assess the learner's level per skill from the whole conversation and pick the curriculum unit to start from (unit numbers: A1 = 1, A2 = 22, B1 = 36, B2 = 50; choose a later unit inside a level if they clearly know earlier units).";
  if (mode === "lesson")
    return "The lesson is over. Evaluate the learner's performance on the drill items and the dialogue. Collect errors with reusable rule labels and the key new words from the lesson.";
  return "The conversation is over. Give a debrief of the LEARNER's German (not yours): scores, top errors, useful phrases they could have used, and new words worth learning.";
}

export function writingSystem(state: AppState): string {
  return `${PRINCIPLES}

${learnerContext(state)}

## Mode: writing coach
You correct German writing at level ${teachingLevel(state.profile.levels.writing)}. Be precise: mark real errors (gender, case, word order, verb position, tense, prepositions, endings, spelling/capitalisation, word choice). Keep the learner's meaning. Explanations go in ${state.profile.nativeLanguage}.`;
}

export function readingSystem(state: AppState): string {
  return `${PRINCIPLES}

${learnerContext(state)}

## Mode: graded reading
Write original, interesting texts at level ${teachingLevel(state.profile.levels.reading)} (A1 ≈ 80 words, A2 ≈ 150, B1 ≈ 300, B2 ≈ 450). Use the learner's interests. At B1+ vary between narrative, news style and opinion. Explanations in ${state.profile.nativeLanguage}.`;
}

export function unitTitle(n: number): string {
  const u = unitByNumber(n);
  return u ? `Unit ${u.n}: ${u.title}` : `Unit ${n}`;
}

export const CHAT_TOPICS: { level: string; topics: string[] }[] = [
  { level: "A1", topics: ["Sich vorstellen (introducing yourself)", "Im Café bestellen", "Einkaufen im Supermarkt", "Nach dem Weg fragen", "Mein Tag", "Meine Familie"] },
  { level: "A2", topics: ["Am Wochenende", "Beim Arzt", "Eine Wohnung suchen", "Im Hotel", "Urlaubspläne", "Ein Termin vereinbaren"] },
  { level: "B1", topics: ["Vorstellungsgespräch (job interview)", "Mit Nachbarn plaudern", "Eine Beschwerde im Restaurant", "Über Hobbys und Sport", "Reisegeschichten", "Leben in Deutschland"] },
  { level: "B2", topics: ["Diskussion: Homeoffice ja oder nein?", "Aktuelle Nachrichten besprechen", "Gehaltsverhandlung", "Umwelt und Klima", "Film oder Buch rezensieren", "Freies Gespräch"] },
];
