# Job Tracker

Track your job applications with an AI assistant: match analysis against your CV, tailored cover letters, CV adaptation, and live job search — all in a fast, local-first React app.

## Features

- **Application pipeline** — add, edit and delete applications; filter by status (Applied, Interview, Offer, Rejected)
- **AI job analysis** — paste a job description and get a 0–100 match score against your CV, matching skills, gaps and a recommendation
- **AI cover letters & CV adaptation** — generated per job, tailored to the description
- **Live job search** — uses Claude's server-side web search to find *real* current listings (no invented jobs or URLs)
- **Cost transparency** — every AI action shows an upfront cost estimate in pounds before you run it
- **Private profile server** — your CV/profile lives in a local, git-ignored file served by a tiny zero-dependency Node backend
- **Attachments & notes** — attach a CV (PDF/DOCX, max 3 MB) and keep notes per application
- **Local-first** — applications are stored in your browser's localStorage; no account needed

## Setup

```bash
pnpm install
cp .env.example .env                                          # add your Anthropic API key
cp server/data/profile.example.json server/data/profile.json  # fill in your CV/profile
pnpm dev                                                      # starts profile server + web app
```

Open [http://localhost:5173](http://localhost:5173).

Get an API key at [console.anthropic.com](https://console.anthropic.com). Without a key the tracker still works; only the AI features are disabled.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the profile server (port 8787) **and** the web app together |
| `pnpm dev:web` / `pnpm dev:server` | Start each one individually |
| `pnpm build` | Production build (injects a Content-Security-Policy) |
| `pnpm preview` | Serve the production build locally |
| `pnpm test` | Run the test suite once (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |

## AI model & costs

The app uses **Claude Sonnet 5** (`claude-sonnet-5`) via the Anthropic Messages API.

Anthropic bills in **USD**; the app displays estimates in **GBP** at a configurable rate (default **$1 ≈ £0.75**, rate of 2 Jul 2026 — set `VITE_USD_TO_GBP` in `.env` to adjust). Prices checked July 2026 on [platform.claude.com](https://platform.claude.com/docs/en/about-claude/pricing):

| Item | USD (billed) | ≈ GBP (displayed) |
|---|---|---|
| Input tokens (until 31 Aug 2026, introductory) | $2 / MTok | £1.50 / MTok |
| Output tokens (until 31 Aug 2026, introductory) | $10 / MTok | £7.50 / MTok |
| Input tokens (from 1 Sep 2026) | $3 / MTok | £2.25 / MTok |
| Output tokens (from 1 Sep 2026) | $15 / MTok | £11.25 / MTok |
| Web search (job search feature) | $0.01 per search (up to 3 per job search) | £0.0075 per search |

Typical per-action cost with introductory pricing:

- Analyse job match: ~**£0.008**
- Cover letter: ~**£0.008**
- Adapt CV: ~**£0.013**
- Full bundle (all three): ~**£0.03**
- Job search (includes live web searches): ~**£0.04**

The in-app "Show cost breakdown" panels compute these from the current prices automatically (the intro→standard price switch happens by date).

## Profile server

Your CV and profile are **not** part of the frontend bundle or the git repository. They live in `server/data/profile.json` (git-ignored) and are served by [server/index.js](server/index.js) — a zero-dependency Node server bound to `127.0.0.1` only:

- `GET /api/profile` — returns `{ cv, profile }` consumed by the AI features
- `GET /api/health` — liveness check

The Vite dev server proxies `/api` to it, so the frontend just fetches `/api/profile`. To update your CV, edit `server/data/profile.json` and refresh the page.

> **Note:** `server/data/profile.json` is listed in `.gitignore` — double-check it stays untracked before pushing.

## Security notes — read before deploying

⚠️ **This app calls the Anthropic API directly from the browser.** The `VITE_ANTHROPIC_API_KEY` value is embedded in the JavaScript bundle at build time. That is acceptable for a **personal tool running locally**, but it means:

- **Never deploy this build to a public URL** — anyone could extract your API key and spend on your account.
- For a public deployment, move the Anthropic calls into the profile server (or a serverless function) so the key stays server-side, and remove the `anthropic-dangerous-direct-browser-access` header.
- `.env` is gitignored — keep it that way. If a key ever leaks, rotate it in the [Anthropic Console](https://console.anthropic.com/settings/keys).

Hardening already in place:

- CV/profile served from a git-ignored file by a localhost-only server (never bundled, never committed)
- Content-Security-Policy injected into production builds (scripts restricted to same origin; network calls restricted to `api.anthropic.com`)
- All user- and AI-supplied links are sanitized (only `http`/`https`; CV attachments only `data:application/pdf` / DOCX)
- CV uploads limited to PDF/DOCX and 3 MB; localStorage quota failures are handled gracefully
- Delete actions require confirmation

## Architecture

```
server/
├── index.js                 # zero-dep profile server (localhost:8787)
└── data/
    ├── profile.example.json # committed template
    └── profile.json         # YOUR real CV/profile — git-ignored
src/
├── App.jsx                  # layout, stats, filtering
├── components/
│   ├── AIPanel.jsx          # AI assistant (analyse + live job search tabs)
│   ├── ApplicationCard.jsx  # one application in the list
│   └── Modal.jsx            # add/edit form with CV upload
├── hooks/
│   └── useApplications.js   # state + localStorage persistence
├── services/
│   └── ai.js                # Anthropic API client, profile fetch, cost estimates
└── utils/
    └── url.js               # URL sanitization helpers
```

## Data & privacy

- Applications, notes and CV attachments live only in your browser's localStorage.
- Your CV/profile lives only in `server/data/profile.json` on your machine.
- When you use an AI feature, the job description **and your CV** are sent to the Anthropic API.
