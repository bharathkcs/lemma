# Gappy AI Hackathon — Submission: AI Support Desk

## Problem statement chosen
**AI Customer Support Desk for a Startup** (curated problem statement).

Small startups get customer issues across email, forms, and chat. A human has to read
each one, look up the relevant policy, write a reply, and track status — slow,
repetitive, and easy to get wrong. Support is the #1 time sink for early teams.

## What the product does
**Support Desk** turns each incoming customer issue into an orchestrated workflow where
AI does the heavy lifting and a human stays in control of every reply:

1. A ticket arrives → it appears in the operator's live inbox.
2. **Triage agent** reads it and classifies **category + priority** (e.g. billing /
   urgent).
3. **Reply-drafter agent** writes a reply **grounded in the company knowledge base**
   (retrieval-augmented — it searches policy docs and cites the source file). It never
   invents policy.
4. **Human approval gate** — the workflow *pauses*. The reviewer sees the draft,
   **approves, edits, or rejects** it. Nothing is sent to the customer until a human
   signs off.
5. On approval the reply is finalized and the ticket is marked **sent**.

Humans and AI agents operate on the **same shared ticket table** — the AI is a
teammate, not a chatbot in a side window.

## How it uses Lemma (meaningfully, not superficially)
- **Tables** — a shared `tickets` table holds the full lifecycle state (channel,
  customer, category, priority, draft, approved reply, status). Row-level security off
  = shared team queue.
- **Files + built-in RAG** — three knowledge-base articles (refund, shipping, account)
  uploaded to `/knowledge`, auto-indexed; the drafter agent searches and reads them.
- **Agents** — two scoped, read-only LLM workers (triage + drafter), each with
  least-privilege grants and a typed `output_schema`.
- **Functions** — deterministic Python (`save_triage`, `save_draft`, `record_decision`)
  do all the writes, with transient-failure retry for reliability.
- **Workflow** — a node graph
  (`FORM → AGENT → FUNCTION → AGENT → FUNCTION → FORM(approval) → DECISION → FUNCTION → END`)
  with a **FORM node as the human-in-the-loop approval gate** that suspends the run
  until a pod member submits a decision.
- **App** — a custom Vite + React desk (Lemma TypeScript SDK) deployed into the pod:
  live inbox, AI pipeline view, and the approve/edit/reject surface that resumes the
  workflow.

## Why it fits "a real workflow someone manages"
This is exactly the daily operating loop of a support lead — not a static site, not a
one-off chatbot. It ingests messy input, maps it to structured state, applies AI
judgment, and **requires human authorization before acting**. It is durable,
observable, and multi-actor — what Lemma is built for.

## Built for production, not just a demo
Beyond the happy path, the console is hardened to stay usable when the workflow engine
misbehaves: the approval queue is driven by the **ticket table as source of truth**
(enriched by live workflow waits, never dependent on them), so a cancelled or timed-out
run never strands a ticket. Approvals **resume** a live run or **commit directly** when
the run is gone, stalled AI runs get a one-click **Retry**, and we found + fixed a real
upstream SDK bug that wedged the approval queue on "Loading…" forever under React
StrictMode. See the *Reliability & hardening* section of the README.

## Links
- **Live app (hosted on lemma.work):** https://support-desk-app.apps.lemma.work
- **Pod access granted to:** ayush@gappy.ai
- **Source / pod bundle (this repo):** https://github.com/bharathkcs/lemma

## How to try it (for judges)
1. Open the app link (sign in as a pod member).
2. Open ticket **#1 "I was charged twice"** → click **Run AI triage + draft**.
3. Watch it get classified (billing/urgent) and a reply drafted from the refund policy.
4. Review the draft → edit if you like → **Approve** → the ticket moves to **Sent**.
5. Ticket **#3** is already a completed example (password-reset, sent).

Built solo for the Gappy AI "Ship to Get Hired" hackathon, powered by the Lemma SDK.
