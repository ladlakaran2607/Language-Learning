# Language-Learning

A personal German course with Claude as the tutor, aiming for B2 (comfortable speaking, reading and writing).

- **[GERMAN_PLAN.md](GERMAN_PLAN.md)**: the roadmap, daily routine, voice practice setup and free resources
- **[.claude/skills/deutsch/](.claude/skills/deutsch/SKILL.md)**: the `/deutsch` tutor skill for Claude Code, plus the [A1→B2 curriculum](.claude/skills/deutsch/curriculum.md)
- **[german/](german/)**: your progress: profile, vocab deck, mistakes, session log, writing journal
- **[WEBAPP_PLAN.md](WEBAPP_PLAN.md)**: plan for a web app version

## Using the tutor

Open this repository in Claude Code (CLI, desktop, or claude.ai/code) and type:

| Command | What it does |
|---|---|
| `/deutsch start` | Placement test and setup (run this first) |
| `/deutsch lesson` | Next grammar unit with drills |
| `/deutsch chat [topic]` | Role-play conversation with corrections |
| `/deutsch write` | Writing prompt or correction of your text |
| `/deutsch read` | Graded reading with glossary and questions |
| `/deutsch review` | Spaced-repetition vocab review |
| `/deutsch progress` | Weekly progress report |

Claude saves your progress into `german/`, so **commit after each session** (or ask Claude to). That way the next session, on any device, picks up where you left off.

To use the skill in the Claude app instead, zip the `.claude/skills/deutsch` folder and upload it as a skill in Claude's settings. Progress tracking only works in Claude Code, though, because it writes to files.
