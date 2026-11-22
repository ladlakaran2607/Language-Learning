# German plan: from zero to B2

**Goal:** talk comfortably, read real texts, and write emails and essays. On the CEFR scale that is **B2**. B1 is "I get by in most situations", B2 is "I'm comfortable".

**Realistic timeline** at 60–90 focused minutes a day:

| Level | What you can do | Cumulative study hours | At ~1 h/day |
|---|---|---|---|
| A1 | Introduce yourself, order food, ask simple questions | ~100–150 | 2–3 months |
| A2 | Handle shops, doctors, offices, describe your day and past | ~250–350 | 5–6 months |
| B1 | Real conversations on familiar topics, simple articles, emails | ~500–650 | 10–12 months |
| B2 | Discuss opinions, follow TV and news, write formal texts | ~800–1000 | 18–24 months |

Hours are approximate and assume an English speaker. More hours a day shortens it; consistency matters more than intensity.

---

## The 4 pillars (do all four every week)

1. **Vocabulary with spaced repetition**, 15 min/day. Always learn nouns with their article and plural: *das Haus, die Häuser*. Use `/deutsch review`, or Anki if you prefer an app.
2. **Grammar in order**, 3–4 lessons/week. Follow the curriculum in `.claude/skills/deutsch/curriculum.md` with `/deutsch lesson`.
3. **Input (listening and reading)**, 20–30 min/day. Lots of German you *mostly* understand.
4. **Output (speaking and writing)**, every day. This is what turns knowledge into fluency.

## Daily routine (about 60–75 min)

| Block | Time | Tool |
|---|---|---|
| Vocab review | 15 min | `/deutsch review` |
| Lesson **or** writing | 20 min | `/deutsch lesson` / `/deutsch write` |
| Speaking practice | 15 min | Claude voice mode or Gemini Live (see below) |
| Listening or reading | 15–25 min | Podcasts, YouTube, `/deutsch read` |

Short on time? Do vocab review plus 10 minutes of speaking. Never skip two days in a row.

---

## How to use AI for each skill

### Speaking: voice conversation
- **Claude app voice mode** (mobile): start with a prompt like the one below, then talk.
- **Gemini Live**: the same prompt works there. Use whichever voice feels more natural to you.
- Starter prompt to paste before talking:

  > You are my German conversation partner. My level is **A2** (change as you improve). Speak only German, slowly and simply. Keep your replies to 1–2 sentences and always end with a question. When I make a mistake, repeat my sentence back correctly once, then continue. Today's topic: **my weekend**.

- After each voice session, paste or summarise it into `/deutsch chat` or `/deutsch write` and ask for the top 3 mistakes, so they land in `german/mistakes.md`.

### Writing
- Write 5–10 sentences a day (a diary works well). `/deutsch write` marks every error, gives a natural native version, and saves the result to `german/journal/`.

### Reading
- `/deutsch read` produces level-matched texts with a glossary and questions.
- From B1 on, add real material such as DW's *Langsam gesprochene Nachrichten* and simple books. Paste in a paragraph you don't understand and ask Claude to explain it.

### Grammar
- `/deutsch lesson` teaches the next unit with drills. If you're confused, ask "explain like I'm A1, with 5 examples".

### Vocabulary
- New words from lessons, readings and chats go into `german/vocab.tsv` automatically, and `/deutsch review` schedules them using Leitner boxes (1, 3, 7, 16, 35 days).

---

## Free resources worth using (alongside Claude)

- **Nicos Weg** (Deutsche Welle): free video course from A1 to B1, the best structured free course.
- **DW Learn German**: placement test, *Langsam gesprochene Nachrichten* (slow news, B1+), *Top-Thema*.
- **Easy German** (YouTube and podcast): real street German with subtitles, A2 and up.
- **Slow German** podcast (Annik Rubens): A2–B1 listening.
- **Anki**: if you want SRS on your phone; you can import `german/vocab.tsv`.
- **Tandem / HelloTalk**: real native speakers, from about A2.
- **Netflix/YouTube with German subtitles** (B1 and up): *Dark*, *How to Sell Drugs Online (Fast)*, *Babylon Berlin*, kids' shows at A2.
- **Milestone exams**: Goethe-Zertifikat or telc B1, then B2. Booking one gives you a deadline.

---

## Milestones and check-ins

- **Every Sunday:** run `/deutsch progress`, then pick one weak area for next week.
- **End of each level:** do the mock test unit in the curriculum. Move on only at 70% or more.
- **Month 3:** a 10-minute voice conversation about yourself without English.
- **Month 6:** write a 150-word email to a landlord or employer with fewer than 5 errors.
- **Month 12:** follow an Easy German episode without subtitles and get the gist.
- **Month 18–24:** discuss a news topic for 20 minutes, and read a novel with a dictionary nearby.

## Start today

1. Open this repo in Claude Code and run **`/deutsch start`** (placement test, about 15 minutes).
2. Watch episode 1 of **Nicos Weg**.
3. Do one 5-minute voice chat in the Claude app using the starter prompt above.
