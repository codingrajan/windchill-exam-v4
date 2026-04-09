# Windchill Implementation Practitioner Mock Exam

A React + TypeScript + Vite mock-test platform for the PTC Windchill Implementation Practitioner exam. The app supports random exams, fixed admin-managed presets, timed quiz sessions, scored results, section analytics, API-focused practice sets, participant-safe report printing, and an authenticated admin console backed by Firebase.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Framer Motion
- Firebase Authentication
- Firebase Firestore
- Vercel-ready static hosting

## What The App Does

- Serves a 550-question Windchill mock-exam bank from JSON files in `public/data`
- Builds random exams using a target difficulty mix and approximately 10% multi-response selection
- Supports fixed exam presets managed from the admin console, including a 10-question Java API sprint
- Scores exams client-side with per-section and per-difficulty analytics
- Stores exam-result summaries in Firestore
- Uses Firebase Authentication to protect the admin console
- Applies participant-side copy/print deterrence during live exams and full report review
- Generates summary-only printable PDFs without question content

## Project Structure

```text
windchill-exam-v4/
  api/
    _lib/
      firebaseAdmin.ts
      http.ts
    admin/
      write.ts
    exam/
      start.ts
      submit.ts
  public/
    data/
      built_in_presets.json
      built_in_sessions.json
      windchill_mock_test_1.json
      windchill_mock_test_2.json
      windchill_mock_test_3.json
      windchill_mock_test_4.json
      windchill_mock_test_5.json
      windchill_mock_test_6.json
      Windchill Technical Essentials course manual.pdf
      Windchill Advanced Configuration course manual.pdf
  reports/
    taxonomy_audit.json
  scripts/
    enrich-question-bank-metadata.mjs
    generate-built-in-presets.mjs
    generate-question-bank-manifest.mjs
    generate-session-schedule-assets.mjs
    generate-taxonomy-audit.mjs
    validate-question-bank.mjs
  src/
    components/
      admin/
      shared/
    constants/
      examStrategy.ts
    hooks/
      useContentProtection.ts
    pages/
      Admin.tsx
      History.tsx
      Welcome.tsx
      Quiz.tsx
      SessionEntry.tsx
      Results.tsx
      ResultReport.tsx
    services/
      authz.ts
      firebase.ts
      presetCatalog.ts
      sessionCatalog.ts
      writeGateway.ts
    types/
      index.ts
    utils/
      certificate.ts
      email.ts
      examInsights.ts
      examLogic.ts
      reportSummary.ts
      studyPlan.ts
    App.tsx
    index.css
    main.tsx
  firestore.rules
  firestore.server.rules
  DEPLOYMENT_QA_CHECKLIST.md
  seed-presets.mjs
  question_generation_guardrails.md
  question_bank_consistency_report.md
  question_bank_overlap_map.md
  vercel.json
```

## Core Flows

### Candidate Flow

1. User lands on the welcome screen.
2. User selects `preset` or `random` mode.
3. App loads the question pool from `public/data/*.json`.
4. App builds the exam set in [`src/utils/examLogic.ts`](./src/utils/examLogic.ts).
5. User takes the timed exam in [`src/pages/Quiz.tsx`](./src/pages/Quiz.tsx).
6. Results are evaluated and summarized in [`src/pages/Results.tsx`](./src/pages/Results.tsx).
7. Result summary is written to Firestore collection `exam_results`.
8. If needed, the user downloads a summary-only PDF without question content.

### Admin Flow

1. Admin signs in with Firebase Auth.
2. Admin can review result history, filter results, export CSV, and delete records.
3. Admin can build and save fixed presets into Firestore collection `exam_presets`.
4. Presets are later used by the welcome screen for fixed exams.

## Question Bank Format

Each question JSON entry follows this shape:

```json
{
  "id": 251,
  "question": "What is the primary purpose of a baseline in Windchill?",
  "codeSnippet": "QuerySpec qs = new QuerySpec(WTPart.class);",
  "options": [
    "To capture a point-in-time definition of selected objects for later reference",
    "To override object numbering schemes across all contexts",
    "To replace a life cycle template during promotion",
    "To distribute vaulted content to remote sites"
  ],
  "correctAnswer": 0,
  "explanation": "A baseline captures a specific snapshot of objects so that exact definitions can be reviewed again later.",
  "topic": "PLM Foundations",
  "domain": "PLM Foundations",
  "difficulty": "easy",
  "type": "single",
  "objective": "Baselines"
}
```

### Supported Question Types

- `single`
  - `correctAnswer` is a number
- `multiple`
  - `correctAnswer` is an array of numbers
- `codeSnippet`
  - optional string rendered as a code block below the question prompt

### Current Pool

- Total questions: `550`
- Single-answer: `490`
- Multiple-response: `60`
- API-focused Java questions: `50`

## Important Source Files

- [`src/utils/examLogic.ts`](./src/utils/examLogic.ts)
  - question loading
  - normalization
  - random exam generation
  - scoring and analytics
- [`src/services/firebase.ts`](./src/services/firebase.ts)
  - Firebase app, auth, and Firestore initialization
- [`src/pages/Welcome.tsx`](./src/pages/Welcome.tsx)
  - exam mode selection
  - preset loading
- [`src/pages/Quiz.tsx`](./src/pages/Quiz.tsx)
  - timer
  - navigation
  - answer state
  - participant content protection
- [`src/pages/Results.tsx`](./src/pages/Results.tsx)
  - score summary
  - result persistence
  - summary PDF generation
- [`src/pages/Admin.tsx`](./src/pages/Admin.tsx)
  - auth-gated admin console
  - reports and preset management
- [`src/components/shared/QuestionPrompt.tsx`](./src/components/shared/QuestionPrompt.tsx)
  - shared question/snippet rendering across quiz and reports

## Local Development

### Prerequisites

- Node.js 20+ recommended
- npm

### Install

```bash
npm install
```

### Start Dev Server

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

## Firebase Setup

The app supports Vite environment variables through `.env`, but the client runtime also has the `windchill-mock-exam-v4` Firebase project baked in as a fallback.

Create a local `.env` file from `.env.example` only if you want to override the baked-in client config or configure admin/server-write behavior.

Examples:

```bash
cp .env.example .env
```

```powershell
Copy-Item .env.example .env
```

Fill in:

```env
VITE_FIREBASE_API_KEY=AIzaSyDqe4YXGVtglnjC3W1ODV4zRcADWtVFjSM
VITE_FIREBASE_AUTH_DOMAIN=windchill-mock-exam-v4.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=windchill-mock-exam-v4
VITE_FIREBASE_STORAGE_BUCKET=windchill-mock-exam-v4.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1088263687851
VITE_FIREBASE_APP_ID=1:1088263687851:web:013cd37e168d565e9071ee
VITE_FIREBASE_MEASUREMENT_ID=G-B2ZEEBH0SE
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
VITE_ENABLE_SERVER_WRITES=false
```

### Public Repo And Firebase Credentials

- The Firebase web app config used by the frontend is intentionally public:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
  - `measurementId`
- These values are not secrets in a browser-based Firebase app.
- Security must come from:
  - Firestore Rules
  - Firebase Authentication
  - optional server-side admin credentials only on Vercel
- Do **not** commit:
  - `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`
  - downloaded Firebase service-account files
  - any private admin secret used only by server functions

The current public frontend config is:

```ts
const firebaseConfig = {
  apiKey: "AIzaSyDqe4YXGVtglnjC3W1ODV4zRcADWtVFjSM",
  authDomain: "windchill-mock-exam-v4.firebaseapp.com",
  projectId: "windchill-mock-exam-v4",
  storageBucket: "windchill-mock-exam-v4.firebasestorage.app",
  messagingSenderId: "1088263687851",
  appId: "1:1088263687851:web:013cd37e168d565e9071ee",
  measurementId: "G-B2ZEEBH0SE"
};
```

### Firestore Collections Used

- `exam_presets`
- `exam_results`

### Authentication Used

- Firebase email/password sign-in for admin access
- Approved admin emails must also be listed in `VITE_ADMIN_EMAILS`

### Optional Server Write Mode

To route critical writes through Vercel serverless functions:

- set `VITE_ENABLE_SERVER_WRITES=true`
- add server-side environment variable `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`
- add server-side environment variable `ADMIN_EMAILS`

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` should contain the full Firebase service account JSON as a single string.

Candidate session starts also move to `/api/exam/start` in this mode, so retake checks and participant record creation stop relying on browser-side writes.

## Recommended Firebase Security Model

Current app model:

- candidates are anonymous browser users
- admins are Firebase Authentication users
- admin-only screens operate behind Firebase sign-in
- Firestore rules should therefore distinguish between:
  - public candidate flows
  - signed-in admin operations

Recommended baseline for this repo:

- `exam_results`
  - public create
  - signed-in admin read/update/delete
- `exam_presets`
  - public read
  - signed-in admin write
- `exam_sessions`
  - public read
  - signed-in admin write
- `session_participants`
  - public create/update
  - signed-in admin read/delete
- `audit_logs`
  - signed-in admin read/write only
- Firebase Auth
  - only admin users should exist here
- Firestore Rules
  - start from `firestore.rules`
  - no email allowlist is required if Firebase Authentication is used only for admins
- Strict Rules Cutover
  - once server writes are fully enabled, switch to `firestore.server.rules`
  - this blocks direct candidate writes to `exam_results` and `session_participants`
- Audit Logging
  - admin-side mutations now write to Firestore collection `audit_logs`
- Server Write Boundary
  - when `VITE_ENABLE_SERVER_WRITES=true`, session start, result submission, and admin mutations use `/api/exam/start`, `/api/exam/submit`, and `/api/admin/write`

If this project later introduces candidate sign-in, move admin authorization from plain `request.auth != null` to either:

- Firebase custom claims
- a strict email allowlist

For the current freeware deployment model, `request.auth != null` is sufficient because only admins authenticate.

### Offline Validation And Asset Generation

Run this before releasing question-bank changes:

```bash
npm run validate:questions
```

Regenerate built-in presets and scheduled sessions after changing the question bank:

```bash
npm run generate:presets
npm run generate:sessions
```

## Deploying To Vercel

### 1. Push To GitHub

Commit the repo and push it to GitHub.

### Public Repository Requirement

- A public GitHub repo is **not** required to host on Vercel.
- Vercel can deploy from:
  - private GitHub repos
  - public GitHub repos
- Public website access is controlled by Vercel deployment settings and your app itself, not by whether the source repo is public.
- If the site should be reachable by all users, the deployment can still come from a private repo.

### 2. Import Into Vercel

In Vercel:

1. Create a new project
2. Import the GitHub repository
3. Framework preset should detect as `Vite`

### 3. Configure Build Settings

Use:

- Build Command: `npm run build`
- Output Directory: `dist`

### 4. Add Environment Variables

In Vercel Project Settings -> Environment Variables, add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_ADMIN_EMAILS`
- `VITE_ENABLE_SERVER_WRITES`

For server write mode, also add these server environment variables in Vercel:

- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`
- `ADMIN_EMAILS`

### 5. Deploy

After the variables are saved, trigger a deployment.

## Notes On Hosting

- The question bank is served statically from `public/data`.
- Because the app is a client-rendered Vite SPA, Vercel hosting is straightforward.
- Firebase configuration values are client-side values and are expected to be exposed to the frontend, but Firestore/Auth rules must still be configured correctly.

## Participant Protection Notes

- Browser-side protections are deterrents, not absolute security.
- Current participant-side controls include:
  - blocked copy/cut/right-click/selection shortcuts during quiz and full-report review
  - blocked full-page printing of question content for non-admin users
  - summary-only printable PDF output without question text
- Admin users remain exempt from those browser-side restrictions.
- These controls do **not** stop:
  - screenshots
  - phone-camera capture
  - determined devtools inspection

## Current Public Presets

- `Sprint 25 - Confidence Builder`
- `Sprint 25 - Pressure Test`
- `Forge 50 - Applied Readiness`
- `Forge 50 - Expert Challenge`
- `Summit 75 - Full Preparation`
- `Summit 75 - Hardline Simulation`
- `API 10 - Customization Sprint`

Hidden scheduled-session presets remain admin-only and are synced through the admin console.

## Content Governance Files

The repo includes supporting audit files used during question-bank expansion:

- [`question_generation_guardrails.md`](./question_generation_guardrails.md)
- [`question_bank_consistency_report.md`](./question_bank_consistency_report.md)
- [`question_bank_overlap_map.md`](./question_bank_overlap_map.md)

These are useful when extending the bank further without repeating concepts.
