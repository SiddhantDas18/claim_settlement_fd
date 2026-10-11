# Claim Intake Assistant: Frontend

React + TypeScript + Vite frontend for the AI claims intake assistant. The backend (FastAPI) lives in the sibling repo `../Claim_Settlement_BD`.

No UI libraries: plain React, a small hash router (`src/router.ts`) and one stylesheet with light/dark design tokens (`src/index.css`).

## Run

```bash
# 1. backend (in ../Claim_Settlement_BD)
source .venv/bin/activate && uvicorn app.main:app --reload     # http://localhost:8000

# 2. frontend
npm install
npm run dev                                                    # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000` (see `vite.config.ts`), so no CORS setup is needed. To point at another backend, set `VITE_API_URL`.

Log in with the admin account from the backend's `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Claimants register on the login page; an admin then adds a policy for them under **Users & policies**.

## Screens

| Route | Who | What |
|---|---|---|
| `#/analyze` | admin | **Analyze playground**: load one of the 24 synthetic test cases (or paste your own form and document texts), run `POST /api/v1/analyze`, see the analysis and whether it matches the test case's expected result |
| `#/claims` | admin | Claims queue with status and the system's triage recommendation |
| `#/claims/:id` | admin | Claim review: claimant's form, uploaded documents (text-extraction method, OCR confidence, extracted text), intake analysis, settlement calculation, approve / reject, re-run analysis |
| `#/payments` | admin | Pending / paid payouts, mark paid (UPI, bank, cheque, cash) |
| `#/policies` | admin | Users and policies; create a policy for a claimant |
| `#/my-claims` | claimant | My claims; create / edit a draft, upload documents (JPEG/PNG/WEBP/PDF), submit |

## How the analysis view shows the three rules

`src/components/AnalysisView.tsx`

- **Nothing invented:** a field no source provides shows a dashed amber **Missing** badge with the reason it is needed; missing documents are listed too.
- **Claimant facts vs system output:** every value carries a badge: **Claim form** (typed by the claimant), **Document: name** (read from an uploaded document) or **System inferred** (purple: document type, expense category, computed sums, triage, next steps). Clicking a field row shows every source's value and the exact quote it came from.
- **Conflicts are not resolved:** each conflict is a card with one column per source (value, provenance, quote); the field's value stays empty and the next steps tell the reviewer what to ask.

Every status uses a colour, an icon and a text label, never colour alone. Amounts are shown in INR with Indian digit grouping (₹1,24,600.00).

## Scripts

```bash
npm run dev      # dev server
npm run build    # type-check + production build
npm run lint     # oxlint
```
