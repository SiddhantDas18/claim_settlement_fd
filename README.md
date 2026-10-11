# Claim Intake Assistant: Frontend

React + TypeScript + Vite frontend for the AI claims intake assistant. The backend (FastAPI) lives in the sibling repo `../Claim_Settlement_BD`.

No UI component library: plain React, Lucide icons, a small hash router (`src/router.ts`) and one stylesheet with light/dark design tokens (`src/index.css`).

## Run

```bash
# 1. backend (in ../Claim_Settlement_BD)
source .venv/bin/activate && uvicorn app.main:app --reload     # http://localhost:8000

# 2. frontend
npm install
npm run dev                                                    # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000` (see `vite.config.ts`), so no CORS setup is needed. To point the dev proxy at another backend, set `BACKEND_URL` (e.g. `BACKEND_URL=http://localhost:8010 npm run dev`); for a separately hosted API, set `VITE_API_URL`.

Log in with the admin account from the backend's `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Claimants register on the login page; an admin then gives them a policy under **Settings**.

## Screens

| Route | Who | What |
|---|---|---|
| `#/claims/review`, `#/claims/pay`, `#/claims/history` | admin | **Claims inbox** with three tabs and search. Each row: claimant, amount, the system's triage and why |
| `#/claim/:id` | admin | **One claim, three blocks:** 1. Needs attention (conflicts, missing items, checks, suggested next steps) · 2. Claim details (each fact with its source tags; "Show sources & quotes"; documents) · 3. Decision (payable amount, how it's calculated, approve / reject, then mark as paid in the same place) |
| `#/test-cases` | admin | Run the AI check on one of the 24 synthetic test cases (or your own text) and see whether it matches the expected result |
| `#/settings` | admin | Give a claimant a policy; list of claimants |
| `#/my-claims` | claimant | My claims, each with a progress line: Submitted → Under review → Approved → Paid |
| `#/claim/new`, `#/claim/:id` | claimant | **3-step wizard:** 1. Your stay (hospital, dates, total) · 2. Documents (slots for hospital bill, discharge summary, other; drag & drop) · 3. Review & submit. Submitted claims show their status |

Icons: [Lucide](https://lucide.dev) (`lucide-react`). Animations are CSS only (fade-in, upload "pop", progress fill, skeleton loading) and are switched off for people who set "reduce motion" in their system.

## How the claim page shows the three rules

`src/components/ClaimSummary.tsx`

- **Nothing invented:** a field no source provides shows an amber **Missing** badge, and block 1 lists each missing item (including missing documents) with the reason it is needed.
- **Claimant facts vs system output:** every value carries small source tags: **Claim form** (typed by the claimant), the document it was read from (e.g. **Hospital bill**), or purple **System** (expense categories, computed sums, triage, suggested next steps). "Show sources & quotes" shows every source's value with the exact quote it came from.
- **Conflicts are not resolved:** block 1 shows what each source says side by side, with the odd one out outlined; the field shows "Documents disagree" instead of a value, and the next steps tell the reviewer what to ask.

Every status uses a colour, an icon and a text label, never colour alone. Amounts are shown in INR with Indian digit grouping (₹1,24,600.00).

## Scripts

```bash
npm run dev      # dev server
npm run build    # type-check + production build
npm run lint     # oxlint
```
