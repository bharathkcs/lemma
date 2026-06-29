# Support Desk — AI Customer Support, Human-in-the-Loop

Built on the **Lemma SDK** for the Gappy AI "Ship to Get Hired" hackathon.

Incoming customer issues are **triaged** by an AI agent, a reply is **drafted by a
second agent grounded in a knowledge base (RAG)**, and **every reply is held at a human
approval gate** — the workflow pauses until a person approves, edits, or rejects the
draft. Humans and AI agents operate on the same shared ticket table.

- **Live app:** https://support-desk-app.apps.lemma.work
- **Problem statement:** AI Customer Support Desk for a Startup

## The loop
```
new ticket → 🤖 triage (category + priority)
           → 🤖 draft reply (RAG over /knowledge, cites sources)
           → 🧑 HUMAN APPROVAL (approve / edit / reject)  ← workflow pauses here
           → ✅ sent (or ↩ rejected)
```

## What's in this repo
- `support-desk/` — the Lemma **pod bundle** (import with `lemma pods import .`):
  - `tables/tickets` — shared support queue + lifecycle state
  - `files/knowledge` + `seed/knowledge` — KB policy docs (RAG corpus)
  - `agents/triage-agent`, `agents/reply-drafter` — read-only AI workers
  - `functions/save_triage`, `save_draft`, `record_decision` — deterministic writes
  - `workflows/support-lifecycle` — orchestration with the human FORM approval gate
  - `apps/support-desk-app/source` — the React operator console (Vite + lemma-sdk)
  - `seed/seed.sh` — uploads KB + sample tickets
- `support-desk/patches/` — a patch for one upstream Lemma SDK bug we hit and fixed
  (see *Reliability* below)
- `BRD.md` / `BRD.docx` — full Business Requirements Document (as-built)
- `SUBMISSION.md` — hackathon submission writeup

## Reliability & hardening
Real workflows fail in messy ways, so the operator console is built to **stay usable
when the engine misbehaves** rather than assume a happy path:

- **The ticket table is the source of truth.** The approval queue is driven by ticket
  `status = awaiting_approval`, *enriched* by a live workflow wait when one exists — it
  is not driven by the live wait alone. So if a workflow run is cancelled or times out,
  the ticket is still actionable instead of becoming an invisible orphan.
- **Dual commit path.** When a live approval wait exists, approving **resumes** the
  workflow; when the run is gone, the decision is **committed directly** via the
  `record_decision` function. The reviewer can always approve/reject.
- **Self-healing triage.** If an AI run stalls mid-pipeline (triaged but no draft), the
  ticket shows a **Retry AI** action that re-runs the lifecycle cleanly.
- **Deterministic writes with retry.** All DB writes are functions (not agent
  tool-calls) with transient-5xx retry, so flaky sandbox→API calls don't corrupt state.
- **Honest UI states.** Loading, error+retry, and empty states everywhere — no silent
  spinners.
- **SDK fix included.** We found and fixed a real upstream bug in the SDK hook
  `useWorkflowRunWaitAssignments` where, under React 18 StrictMode, an aborted first
  request left the approval queue stuck on "Loading…" forever. The one-line-region fix
  is captured in `support-desk/patches/lemma-sdk-approval-queue-loading-fix.patch`.
- The pure lifecycle logic (`apps/.../src/lifecycle.ts`) is small, framework-free, and
  unit-tested.

## Run it
See `support-desk/README.md` for the full setup runbook (`lemma pods create` →
`import` → `seed.sh` → `apps deploy`).
