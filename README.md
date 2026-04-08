# Windchill Implementation Practitioner Mock Exam

A React + TypeScript + Vite mock-test platform for the PTC Windchill Implementation Practitioner exam. The app supports random exams, fixed admin-managed presets, timed quiz sessions, scored results, domain analytics, and an authenticated admin console backed by Firebase.

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

- Serves a 500-question Windchill mock-exam bank from JSON files in `public/data`
- Builds random exams using a target difficulty mix and approximately 10% multi-response selection
- Supports fixed exam presets managed from the admin console
- Scores exams client-side with per-domain and per-difficulty analytics
- Stores exam-result summaries in Firestore
- Uses Firebase Authentication to protect the admin console

## Project Structure

```text
windchill-exam-v3/
  public/
    data/
      windchill_mock_test_1.json
      windchill_mock_test_2.json
      windchill_mock_test_3.json
      windchill_mock_test_4.json
      windchill_mock_test_5.json
      Windchill Technical Essentials course manual.pdf
      Windchill Advanced Configuration course manual.pdf
  src/
    pages/
      Welcome.tsx
      Quiz.tsx
      Results.tsx
      Admin.tsx
    services/
      firebase.ts
    types/
      index.ts
    utils/
      examLogic.ts
  question_generation_guardrails.md
  question_bank_consistency_report.md
  question_bank_overlap_map.md
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

### Current Pool

- Total questions: `500`
- Single-answer: `440`
- Multiple-response: `60`

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
- [`src/pages/Results.tsx`](./src/pages/Results.tsx)
  - score summary
  - result persistence
- [`src/pages/Admin.tsx`](./src/pages/Admin.tsx)
  - auth-gated admin console
  - reports and preset management

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

For production, do not rely on open client writes.

Recommended minimum:

- `exam_results`
  - authenticated admin read
  - controlled write strategy
- `exam_presets`
  - authenticated admin read/write only
- Firebase Auth
  - only admin users should be able to sign in to the admin console
- Firestore Rules
  - start from `firestore.rules`
  - replace the placeholder admin email with your actual admin email list
- Strict Rules Cutover
  - once server writes are fully enabled, switch to `firestore.server.rules`
  - this blocks direct candidate writes to `exam_results` and `session_participants`
- Audit Logging
  - admin-side mutations now write to Firestore collection `audit_logs`
- Server Write Boundary
  - when `VITE_ENABLE_SERVER_WRITES=true`, session start, result submission, and admin mutations use `/api/exam/start`, `/api/exam/submit`, and `/api/admin/write`

If this project is hardened further, result writes and admin mutations should move behind a trusted backend boundary such as Vercel functions or Firebase callable functions.

### Offline Validation

Run this before releasing question-bank changes:

```bash
npm run validate:questions
```

## Deploying To Vercel

### 1. Push To GitHub

Commit the repo and push it to GitHub.

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

## Known Follow-Up Recommendations

- Move result submission and admin mutations behind server-side functions
- Persist in-progress exam state to session storage or local storage
- Add stronger admin role validation beyond basic client-side auth state handling
- Replace any remaining UI text encoding artifacts with clean ASCII copy
- Add automated validation scripts for question-bank schema and concept overlap checks

## Content Governance Files

The repo includes supporting audit files used during question-bank expansion:

- [`question_generation_guardrails.md`](./question_generation_guardrails.md)
- [`question_bank_consistency_report.md`](./question_bank_consistency_report.md)
- [`question_bank_overlap_map.md`](./question_bank_overlap_map.md)

These are useful when extending the bank further without repeating concepts.
