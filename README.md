# AI Job Tracker

This project helps a candidate manage applications in one place while using AI to compare a role against their CV, draft tailored cover letters, adapt CV content, and surface relevant live job listings. The main problem it solves is turning scattered application tracking and ad hoc AI prompting into a single workflow with clear match scoring, cost visibility, and persisted records. The technical interest comes from the React interface, local-first persistence, a small Node profile server, and AI-powered workflows that combine user input, server-side profile data, and validation before sending requests.

## Technology Stack

* React 18 with Vite
* JavaScript / JSX
* CSS Modules for component-level styling
* Vitest + React Testing Library + jsdom
* Node.js for the local profile server
* Anthropic Messages API integration
* Browser localStorage for application persistence

## Overview

The app gives a user a lightweight job-tracker workflow: they record applications, review AI match results for a job description, and then either generate a cover letter, adapt their CV, or search for live roles using the same profile context. The interface is organised around a single application pipeline where job data can be analysed, saved, filtered by status, and revisited later.

Each application is stored locally in the browser, while the CV/profile content is loaded from a local server endpoint rather than being hard-coded into the frontend bundle. That makes the app practical for personal use while keeping the UI focused on application management and AI-assisted decision support.

## Key Features

* Job application tracking with status-based filtering for applied, interview, offer and rejected records
* AI-powered job matching through a scored analysis of the job description against the stored CV/profile
* AI-generated cover letters tailored to the specific role and company
* CV adaptation that rewrites the profile around the job requirements
* Live job search that validates and filters result URLs before displaying them
* Cost estimation for AI actions, displayed in GBP from the model pricing calculations
* Local-first app data persistence with browser storage
* Private profile serving from a local Node server instead of storing personal profile data in the repo
* CV upload support for PDF and DOCX files with a file-size limit
* Notes and optional job/company links attached to each application record

## Technical Highlights

The project is structured as a small React application with several distinct responsibilities rather than a single monolithic screen. The main application shell in `App.jsx` coordinates the tracker state, status filters, modal interaction, and the AI panel. The AI panel, in turn, manages async workflows for analysis, cover letters, CV adaptation and job search, with explicit loading, success and error states for each action.

The data layer is separated from the UI. The custom hook `useApplications.js` handles initial state, persistence and updates for application records, while `src/services/ai.js` centralises profile fetching, Anthropic API calls, cost estimation and live-search orchestration. Shared validator logic also lives in `src/utils/url.js`, which enforces HTTP/HTTPS-only URLs and restricts uploaded CV data URLs to the supported formats.

Other frontend engineering decisions visible in the code include:

* CSS Modules for component-level styling and less cross-component coupling
* asynchronous request handling with try/catch flow and user-facing error display
* controlled form state for job entries, CV attachments and search filters
* URL validation before results are accepted or rendered
* client/server separation through a local profile service and Vite proxy config
* safeguards around storage quota failures and malformed profile data

## Architecture

```text
server/
├── index.js
├── data/
│   ├── profile.example.json
│   └── profile.json          # local-only profile data, git-ignored

src/
├── App.jsx                   # app shell, filters, modal orchestration
├── App.module.css
├── App.test.jsx
├── components/
│   ├── AIPanel.jsx           # AI analysis, cover letter, CV generation and search UI
│   ├── AIPanel.module.css
│   ├── AIPanel.test.jsx
│   ├── ApplicationCard.jsx   # individual application card
│   ├── ApplicationCard.module.css
│   ├── Modal.jsx             # add/edit application form and CV upload flow
│   ├── Modal.module.css
│   └── Modal.test.jsx
├── hooks/
│   ├── useApplications.js    # persisted application state and CRUD updates
│   └── useApplications.test.js
├── services/
│   ├── ai.js                 # Anthropic API calls, profile fetch, pricing and job search logic
│   └── ai.test.js
├── utils/
│   ├── url.js                # URL and CV data validation helpers
│   └── url.test.js
├── test/
│   └── setup.js
├── index.css
└── main.jsx
```

The main responsibilities are straightforward:

* `server/index.js` serves the local profile payload from a localhost-only endpoint at `127.0.0.1:8787`
* `src/App.jsx` is the application shell and keeps the tracker state harmonised with the UI
* `src/components/` contains the reusable panels and forms that make up the user journey
* `src/hooks/useApplications.js` manages the application list and local persistence
* `src/services/ai.js` keeps model integration, pricing logic and parsed responses separate from rendering
* `src/utils/url.js` validates user-supplied links and attachment data before they are accepted

## Testing

The project uses Vitest, React Testing Library and jsdom for frontend and service-level verification. The current repository contains 6 test files covering the core user flows and supporting logic, including:

* AI panel behaviour and async user actions
* application management and filtering
* modal form interaction and CV upload safeguards
* AI service request/response parsing and validation logic
* URL sanitisation and filtering rules

The latest full test run passed with 63 tests passing. The latest coverage result reported 84.39% statement coverage overall across the project. Coverage is produced through V8, and the tests include mocked external AI/service calls where appropriate to validate the real behaviour of the app without depending on live API access.

## Continuous Integration

The CI workflow is defined in `.github/workflows/ci.yml` and currently runs on pushes and pull requests to the main branch. It does the following:

1. checks out the repository
2. sets up pnpm
3. sets up Node.js
4. installs dependencies with the frozen lockfile
5. runs the test suite
6. runs the production build

There is no deployment step in the workflow, so this project currently verifies build and test health rather than publishing the app.

## Security & Privacy

This project implements a local-first privacy model rather than a public production auth model. The personal CV/profile is stored in `server/data/profile.json` and is intentionally not committed to the repository; this file is ignored by git via the repository settings in `.gitignore`.

The profile content is served by the local Node server at `127.0.0.1` and exposed through a Vite proxy on `/api/profile`. This keeps the data resident on the machine rather than bundled into the frontend build.

The AI integration currently calls the Anthropic API directly from the browser using `VITE_ANTHROPIC_API_KEY` in the frontend environment. That is workable for a private/local tool, but it also means the API key is exposed to any client running the app, and it is not suitable for a public deployment without moving those requests behind a backend endpoint. This risk is already acknowledged in the current code and configuration, and the project does not claim a production-ready public security model.

In addition, the code does a small amount of sanitisation and validation:

* URL validation allows only HTTP and HTTPS links via `safeHttpUrl`
* CV attachment data URLs are restricted to PDF and DOCX formats
* the production build injects a Content Security Policy
* the profile server binds to localhost only and does not expose the profile on the network
* application data is stored in browser localStorage rather than a remote database

## Getting Started

Install dependencies and start the app with pnpm:

```bash
pnpm install
pnpm dev
```

This starts the local profile server and the Vite frontend together. The app is served at the local Vite development URL, while the profile and CV data are served from the local profile server.

If you need to set up your personal profile or AI configuration:

```bash
cp server/data/profile.example.json server/data/profile.json

# Then update the profile data in server/data/profile.json

cp .env.example .env

# Then set VITE_ANTHROPIC_API_KEY in .env if you want the AI features enabled
```

Available project commands:

```bash
pnpm dev
pnpm dev:web
pnpm dev:server
pnpm test
pnpm test:watch
pnpm exec vitest run --coverage
pnpm run build
pnpm preview
```

## Project Scripts

| Command                           | Purpose                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                        | Starts the local profile server and the Vite dev environment together |
| `pnpm dev:web`                    | Starts only the Vite frontend                                         |
| `pnpm dev:server`                 | Starts only the local profile server                                  |
| `pnpm test`                       | Runs the Vitest suite once                                            |
| `pnpm test:watch`                 | Runs Vitest in watch mode                                             |
| `pnpm exec vitest run --coverage` | Runs the suite with V8 coverage reporting                             |
| `pnpm run build`                  | Produces a production build                                           |
| `pnpm preview`                    | Serves the production build locally                                   |

## Future Improvements

The clearest next step is architectural rather than feature-driven: move the Anthropic requests behind a dedicated server-side API so the API key remains off the client bundle. That would retain the current frontend behaviour while reducing the security risk of a browser-side key. Beyond that, the current project already demonstrates the main workflow effectively, so the next improvements would likely focus on hardening the server boundary and expanding the test coverage for edge cases.

## Screenshots
<img width="1912" height="1558" alt="image" src="https://github.com/user-attachments/assets/c8d96d7d-cd9b-482e-8970-1b66e3670792" />

<img width="1912" height="1558" alt="image" src="https://github.com/user-attachments/assets/4add0394-2240-41df-a873-890a49d20626" />

<img width="1912" height="1326" alt="image" src="https://github.com/user-attachments/assets/38857e20-6116-4165-a1ec-ecff08cbe83a" />




