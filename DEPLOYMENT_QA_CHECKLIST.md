# Deployment QA Checklist

## Core Access

- Open `/`
- Confirm public home shows only 6 public presets
- Confirm hidden session presets do not appear on home
- Confirm `My Result History` opens
- Confirm admin console requires Firebase Authentication

## Preset Flow

- Start one public preset exam
- Confirm certificate eligibility appears only for passed preset attempts
- Confirm no retest or remediation buttons appear for preset attempts

## Random Flow

- Start one random exam
- Confirm track and experience controls are visible
- Confirm remediation or retest actions remain available only for random attempts

## Session Flow

- Open `Admin -> Exam Sessions`
- Confirm built-in sessions sync into Firestore
- Confirm scheduled sessions show:
  - access code `plural`
  - one-attempt limit
  - correct start and end windows
- Open one session link
- Confirm home is locked during active session
- Submit one session result
- Confirm:
  - one `exam_results` row
  - one completed participant row
  - one report row in admin
  - one history row by email

## Reports And History

- Open admin `Exam Reports`
- Confirm `View Report` works
- Export reports CSV
- Open `My Result History`
- Look up by email
- Confirm stored report opens
- Confirm certificate download works for passed preset or session attempts

## Session Operations

- Upload candidate list with duplicates
- Confirm duplicates are removed and warning is shown
- Save candidate list
- Export session leaderboard CSV
- Export session activity CSV

## Content Governance

- Open `Content Intel`
- Confirm section coverage renders
- Confirm question QA audit renders
- Confirm source, manual, and misconception coverage renders

## Security And Data

- Confirm anonymous candidate can:
  - start session
  - submit result
- Confirm signed-in admin can:
  - create, edit, and delete presets
  - create, edit, and delete sessions
  - read reports
- Confirm anonymous user cannot open admin-only data screens

## Regression

- Run `npm run validate:questions`
- Run `tsc -b`
- Confirm no duplicate report rows
- Confirm analytics still derive from reports as expected
