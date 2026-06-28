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
- `BRD.md` / `BRD.docx` — full Business Requirements Document (as-built)
- `SUBMISSION.md` — hackathon submission writeup

## Run it
See `support-desk/README.md` for the full setup runbook (`lemma pods create` →
`import` → `seed.sh` → `apps deploy`).
