# Deutsch Tutor web app

A German tutor that works in any browser, on a phone or a laptop. It's a static site (React + Vite) that calls Claude directly from the browser with your own API key, so it can be hosted for free on GitHub Pages.

## Features

| Screen | What it does |
|---|---|
| **Home** | Streak, level, deck size, units done, today's plan, recurring mistakes, recent sessions |
| **Chat** | Role-play conversations at your level, with a ✏️ correction after each reply. 🎙️ speak instead of typing, 🔊 replies read aloud, 🌐 translate, hands-free voice mode. **Finish & save** gives a debrief (scores, errors, useful phrases) and adds new words to your deck |
| **Words** | Spaced-repetition flashcards (Leitner boxes: 1, 3, 7, 16, 35 days). English → German needs the article and plural for nouns. Deck search, add with AI autofill, TSV import and export (Anki, and the skill's `german/vocab.tsv`) |
| **Lessons** | The 60-unit A1→B2 curriculum, read from `.claude/skills/deutsch/curriculum.md`. Each lesson is interactive: examples, rule, drills, mini dialogue. Pass at 80% |
| **Write** | Writing tasks at your level. Every error is marked inline, with a clean version, a native version and a journal |
| **Read** | Generated stories at your level, read aloud. Tap any word to look it up, plus a glossary and comprehension questions |
| **Settings** | API key, model, phone ↔ laptop sync, profile, voice, backup |

The placement test (Home → Find your level) sets your level per skill and your starting unit.

## Setup

1. **Anthropic API key.** Create one at https://console.anthropic.com/settings/keys, add credit, and set a monthly spend limit. Paste it into Settings on each device. It's stored only in that browser and is sent only to `api.anthropic.com`.
2. **Sync (optional).** Create a GitHub token with only the `gist` scope (Settings has the link). Paste it on your first device and press Connect: the app creates a secret gist and shows its ID. On your other device, paste the same token and that Gist ID. Progress then merges automatically whenever the app opens or something changes. The API key and token are never synced.
3. **Phone home screen.** Open the site, then use Share → Add to Home Screen (iPhone) or ⋮ → Add to Home screen (Android). It opens full-screen like an app.

## Deployment

`.github/workflows/deploy-pages.yml` tests, builds and deploys `web/` to GitHub Pages on every push to `main` that touches the app. One-time setup: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Development

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (scheduling, answer checking, sync merge, TSV, curriculum)
npm run build    # outputs web/dist
```

## Notes

- Default model: Claude Opus 5.5 (best tutor). Sonnet 5.5 and Haiku 5.5 are cheaper options in Settings. Conversations run at low effort for fast replies; corrections and evaluations at medium.
- Speech recognition uses the browser's Web Speech API (Chrome, Edge, Safari). Firefox doesn't support it; use your keyboard's dictation mic instead.
- Text-to-speech uses the device's German voice. Install one in system settings if none shows up.
