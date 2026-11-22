# Web app plan: German tutor

A proposal for turning the `/deutsch` skill into a web app you can use from any browser or phone. Not built yet.

## Core features (v1)

| Feature | What it does | How |
|---|---|---|
| **Tutor chat** | Text conversation in German with inline corrections (`✏️ Korrektur`) and an end-of-chat debrief | Claude API, streaming; system prompt from `.claude/skills/deutsch/SKILL.md` |
| **Voice mode** | Talk out loud and hear replies | Browser Web Speech API (speech-to-text, de-DE) + speech synthesis; upgrade to a cloud speech or TTS service later for better voices |
| **Vocab SRS** | Flashcards with article and plural checking; words added automatically from chats and readings | FSRS or Leitner scheduling, stored in the database |
| **Lessons** | Curriculum A1→B2 with drills, progress unlocking | `curriculum.md` as data; Claude generates drills per unit |
| **Writing corrector** | Paste or write text → marked errors, clean version, native version | Claude API with structured JSON output |
| **Graded reading** | Level-matched stories with tap-to-translate words and questions | Claude-generated text; tap a word to add it to the deck |
| **Progress dashboard** | Streak, level per skill, deck by box, top mistakes | Database aggregates |

## Suggested stack

- **Next.js** (React, TypeScript) + Tailwind, as one deployable app (Vercel or similar)
- **Claude API** through server routes, so the API key never reaches the browser
- **SQLite with Drizzle** to start (Postgres or Supabase if you want multiple devices or users)
- Auth: none for personal use at first; add it before sharing

## Data model (sketch)

- `profile`: level per skill, goals, current unit, streak
- `cards`: de, en, type, article, plural, example, scheduling fields
- `mistakes`: type, pattern, count, last example
- `sessions`: date, mode, summary, score
- `journal`: date, original, corrected, native

## Build order

1. Tutor chat with corrections (the highest-value part)
2. Vocab SRS + auto-adding words from chats
3. Voice mode
4. Writing corrector + journal
5. Lessons and curriculum progress
6. Graded reading + dashboard

## Cost note

A personal tutor app costs little on the Claude API at about an hour a day, but put a monthly spending limit on your API key either way.
