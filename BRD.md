% Business Requirements Document
% Support Desk — AI Customer Support, Human-in-the-Loop
% Gappy AI "Ship to Get Hired" Hackathon · Powered by the Lemma SDK

# Business Requirements Document (BRD)

## Support Desk — AI Customer Support Desk with Human Approval

| Field | Value |
|---|---|
| **Product name** | Support Desk |
| **Author / Builder** | Bharath Kumar K C S (solo entry) |
| **Hackathon** | Gappy AI — "Ship to Get Hired", powered by the Lemma SDK |
| **Problem statement chosen** | *AI Customer Support Desk for a Startup* (curated) |
| **Document version** | 2.0 (as-built) |
| **Date** | 2026-06-28 |
| **Status** | Built, deployed, and verified end-to-end on Lemma Cloud |
| **Live app** | https://support-desk-app.apps.lemma.work |
| **Pod** | `support-desk` (`019f0a6f-ff0c-7386-8364-fec76bcde5bb`) |
| **Org** | G25012's Space (`019f0a6b-d7e8-76c9-a2a0-5c9bbd2fa069`) |
| **Pod access granted to** | ayush@gappy.ai (Pod Admin invite) |

> **Note on version 2.0.** The original strategy document proposed *CapturePod* (an
> RFP compliance engine). After reading the live Lemma SDK and weighing the hackathon's
> judging weights (35% problem clarity & real-world fit), the build pivoted to the
> **AI Customer Support Desk** curated problem statement — a workflow judges and the
> hiring partner (YesMadam) can immediately recognize as real, demoable daily work.
> This BRD documents the **as-built** product.

---

## 1. Executive Summary

Support Desk is an AI-native customer-support workspace where AI agents and a human
operator work as peers on the same shared data. Incoming customer issues are
automatically **triaged** (categorized and prioritized) and a reply is **drafted by AI
grounded in the company knowledge base** (retrieval-augmented generation). Critically,
**every reply is held at a human approval gate** — the workflow pauses until a person
approves, edits, or rejects the draft. Nothing is ever sent to a customer by AI alone.

The product is built entirely on Lemma primitives — Tables, Files, Agents, Functions,
a Workflow with a human FORM gate, and a custom React App — and runs live on
lemma.work. It demonstrates stateful, multi-agent orchestration with mandatory
human-in-the-loop authorization, which generic chatbot stacks cannot replicate without
heavy custom plumbing.

---

## 2. Problem Statement, Current Workflow & Pain Points

### 2.1 Problem
Small startups receive customer issues across email, web forms, and chat. Each issue
must be read, understood, categorized, prioritized, answered accurately against company
policy, and tracked to resolution. This is high-volume, repetitive, policy-bound work
that consumes scarce founder/early-team time and is error-prone under load.

### 2.2 Current (manual) workflow
1. Customer message arrives in an inbox.
2. A human reads it and mentally classifies it (billing? shipping? account?).
3. The human judges urgency.
4. The human looks up the relevant policy doc (refund window, shipping SLA, reset steps).
5. The human writes a reply from scratch.
6. The human sends it and updates a tracker/spreadsheet.

### 2.3 Pain points
- **Slow:** 5–10 minutes of skilled work per ticket; doesn't scale.
- **Inconsistent:** replies vary by agent; policy details get misquoted.
- **Error-prone:** missed urgency (e.g., a double charge sitting in a generic queue).
- **No durable state:** status lives in heads and spreadsheets.
- **Compliance risk:** without a review step, wrong/again-the-policy replies go out.

### 2.4 The 10× improvement
AI does the read → classify → research → draft work in seconds; the human does only
the high-value **review and authorize** step. The same person handles far more tickets,
with consistent, policy-grounded replies and a full audit trail — while retaining
control over what actually reaches the customer.

---

## 3. Target Users, Personas & Market

### 3.1 Target market
Early-stage and small startups (D2C/e-commerce, SaaS, marketplaces) with a small or
single-person support function; the broader SMB customer-support tooling market.

### 3.2 Personas
- **Support Lead / Founder (primary operator).** Wants to clear the queue fast without
  losing control or quality. Reviews and approves AI drafts.
- **AI Triage Agent (Lemma agent).** Read-only worker that classifies tickets.
- **AI Reply-Drafter Agent (Lemma agent).** Read-only worker that drafts replies from
  the knowledge base.

### 3.3 User stories
- *As a Support Lead,* I want incoming issues automatically classified by category and
  priority so I can focus on what matters first.
- *As a Support Lead,* I want the AI to draft a reply grounded in our real policies so I
  don't write from scratch or misquote policy.
- *As a Support Lead,* I want to **review, edit, approve, or reject** every reply before
  it's sent, so a human is always accountable for customer communication.
- *As a Support Lead,* I want each ticket's status and history tracked durably so
  nothing falls through the cracks.

---

## 4. Goals, Scope & Success Criteria

### 4.1 In scope (built)
- Shared ticket queue with full lifecycle state.
- A searchable knowledge base (RAG) the drafter agent reads.
- Automatic triage (category + priority).
- AI-drafted, policy-grounded replies with source citation.
- Human approval gate (approve / edit / reject) that resumes the workflow.
- A custom operator app (inbox + approval queue) deployed into the pod.

### 4.2 Out of scope (this hackathon build)
- Live inbound channel connectors (Gmail/Slack ingestion) — tickets are created via
  seed/API; the architecture supports a `DATASTORE_EVENT` or connector trigger later.
- Actually emailing the customer on "send" — `sent` records the approved reply; wiring
  an outbound connector is a documented next step.
- Multi-tenant org separation, analytics dashboards, SLA timers.

### 4.3 Success criteria (all met)
- ✅ A new ticket flows automatically through triage → draft → approval-pause.
- ✅ The drafter cites the actual KB file used (RAG verified).
- ✅ The workflow **suspends** at a human FORM and resumes only on submission.
- ✅ Approve writes the final reply and marks the ticket `sent`; reject marks `rejected`.
- ✅ A custom app surfaces the inbox and an approval queue with working controls.
- ✅ The whole loop runs on Lemma Cloud and was verified COMPLETED end-to-end.

---

## 5. Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-1 | Store each customer issue as a structured ticket with lifecycle status. | ✅ |
| FR-2 | Maintain a searchable knowledge base of policy documents. | ✅ |
| FR-3 | Classify a ticket's category and priority automatically (AI). | ✅ |
| FR-4 | Persist the classification and advance status to `triaged`. | ✅ |
| FR-5 | Draft a customer reply grounded in the KB (RAG), citing sources. | ✅ |
| FR-6 | Persist the draft and advance status to `awaiting_approval`. | ✅ |
| FR-7 | Pause the workflow and assign an approval task to a human. | ✅ |
| FR-8 | Let the human approve, **edit the reply**, or reject, with notes. | ✅ |
| FR-9 | On approve: store final reply, set status `sent`. On reject: set `rejected`. | ✅ |
| FR-10 | Provide an operator UI: ticket inbox + approval queue with controls. | ✅ |
| FR-11 | Reflect live state changes in the UI without polling. | ✅ |
| FR-12 | Enforce least-privilege access for each AI worker. | ✅ |

---

## 6. Non-Functional Requirements

- **Security / least privilege:** Each agent and function is granted only the specific
  tables/folders it touches (zero-access-by-default). Agents are **read-only**; all
  writes go through dedicated functions.
- **Reliability:** All write functions retry transient backend failures (observed
  intermittent 502 / connection-refused on the function sandbox) with backoff.
- **Auditability:** Every ticket records the customer message, AI classification, KB
  sources used, the final approved reply, and reviewer notes.
- **Human authorization:** No customer-facing action is finalized without an explicit
  human form submission (the workflow mathematically suspends).
- **Model cost control:** Default model `gpt-4o-mini` (cheap, fast) via a user-supplied
  OpenAI key; sufficient because agents only judge/return and never do fragile writes.
- **Portability:** The entire pod is a file bundle (version-controllable, importable).

---

## 7. System Architecture

### 7.1 High-level flow

```
                       ┌─────────────────────────────────────────────┐
   Customer issue ───▶ │  tickets (shared table)  ◀── single source  │
                       └─────────────────────────────────────────────┘
        │
        ▼  Workflow: support-lifecycle (MANUAL start, entry FORM = ticket_id)
   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────────┐
   │ AGENT    │──▶│ FUNCTION     │──▶│ AGENT    │──▶│ FUNCTION     │
   │ triage   │   │ save_triage  │   │ drafter  │   │ save_draft   │
   │ (read)   │   │ (write)      │   │ (RAG)    │   │ (write)      │
   └──────────┘   └──────────────┘   └──────────┘   └──────────────┘
                                                            │
                                                            ▼
                                              ┌───────────────────────────┐
                                              │ FORM: human approval       │  ⏸ run
                                              │ (assigned to a pod member) │  SUSPENDS
                                              └───────────────────────────┘
                                                            │ submit
                                                            ▼
                                              ┌───────────────────────────┐
                                              │ DECISION: approved?        │
                                              └───────────────────────────┘
                                            approved │            │ rejected (default edge)
                                                     ▼            ▼
                                       FUNCTION record_decision (sent / rejected)
                                                     │
                                                     ▼
                                                    END
```

### 7.2 Lemma primitives used

| Primitive | Name(s) | Role |
|---|---|---|
| **Table** | `tickets` | Shared support queue + full lifecycle state (RLS off = team-shared). |
| **Files** | `/knowledge/*.md` | Policy KB (refund, shipping, account), auto-indexed for RAG. |
| **Agent** | `triage-agent` | Read-only; classifies category + priority; typed `output_schema`. |
| **Agent** | `reply-drafter` | Read-only; searches `/knowledge`, drafts reply + cites sources. |
| **Function** | `save_triage` | Writes triage result; status → `triaged`. |
| **Function** | `save_draft` | Writes draft + sources; status → `awaiting_approval`. |
| **Function** | `record_decision` | Commits human decision; status → `sent` / `rejected`. |
| **Workflow** | `support-lifecycle` | Orchestrates the graph above with the human FORM gate. |
| **App** | `support-desk-app` | React operator console (inbox + approval queue). |
| **Runtime profile** | OpenAI (BYO key) | `gpt-4o-mini` default via user's OpenAI key. |

### 7.3 Key architectural decision (as-built)
The original design had agents write directly to the table. In testing, the chosen
cost-efficient model (`gpt-4o-mini`) could not reliably emit the nested object argument
required by the agent write tool (it looped on an empty payload). The architecture was
therefore changed so that **agents are read-only and only return structured output**,
while **deterministic Python functions perform all writes**. This is also Lemma's
documented best practice (read-only classifier + validate-then-write function) and makes
the pipeline model-robust and auditable.

---

## 8. Data Model

### 8.1 Table: `tickets` (shared; `enable_rls: false`)

System-managed columns (auto): `id` (UUID v7 PK), `created_at`, `updated_at`.

| Column | Type | Notes |
|---|---|---|
| `number` | SERIAL (auto, unique) | Human-friendly ticket number. |
| `channel` | ENUM | email \| form \| slack \| chat (default email). |
| `customer_email` | TEXT | |
| `customer_name` | TEXT | |
| `subject` | TEXT (required) | |
| `body` | TEXT (required) | The customer's message. |
| `category` | ENUM | billing \| shipping \| account \| technical \| refund \| other. *Set by triage.* |
| `priority` | ENUM | low \| normal \| high \| urgent. *Set by triage.* |
| `triage_reason` | TEXT | *Set by triage.* |
| `draft_reply` | TEXT | *Set by drafter.* |
| `kb_sources` | TEXT | KB files cited. *Set by drafter.* |
| `approved_reply` | TEXT | *Set on human approval.* |
| `reviewer_notes` | TEXT | *Set on human decision.* |
| `status` | ENUM (required) | new → triaged → drafted → awaiting_approval → sent \| rejected. |
| `run_id` | TEXT | Optional link to the workflow run. |

### 8.2 Files: `/knowledge/`
- `refund-policy.md` — refund window, double-charge handling, non-refundables.
- `shipping-and-delivery.md` — SLAs, tracking, delayed/lost packages, international.
- `account-and-login.md` — password reset (60-min expiry), 2FA, email-change verification.

Auto-indexed (markdown is a document format), so the drafter agent can search and read
them via the POD toolset.

---

## 9. Agents (specifications)

### 9.1 `triage-agent`
- **Toolsets:** POD.
- **Grants:** `tickets` — `datastore.table.read`, `datastore.record.read` (read-only).
- **Output schema:** `{ category (enum), priority (enum), triage_reason }` (required:
  category, priority, triage_reason).
- **Behavior:** Reads the ticket by id, decides category + priority with a one-line
  reason, returns structured output. Does **not** write.

### 9.2 `reply-drafter`
- **Toolsets:** POD.
- **Grants:** `tickets` (read), `/knowledge` folder — `folder.read`.
- **Output schema:** `{ draft_reply, kb_sources }` (required: draft_reply).
- **Behavior:** Search-first over `/knowledge`, read the converted markdown, write a
  warm, accurate, policy-grounded reply, cite source files, return structured output.
  Never invents policy; never sends; does **not** write to the table.

---

## 10. Functions (specifications)

All functions: type `API`, grants on `tickets`
(`datastore.table.read`, `datastore.record.read`, `datastore.record.write`), with
transient-failure retry (4 attempts, backoff).

| Function | Input | Effect |
|---|---|---|
| `save_triage` | ticket_id, category, priority, triage_reason | Writes triage fields; status → `triaged`. |
| `save_draft` | ticket_id, draft_reply, kb_sources | Writes draft + sources; status → `awaiting_approval`. |
| `record_decision` | ticket_id, approved (bool), final_reply?, reviewer_notes? | Approve → `approved_reply`=edited/draft, status `sent`. Reject → status `rejected`. Notes saved either way. |

---

## 11. Workflow: `support-lifecycle`

- **Start:** MANUAL; entry **FORM** `intake` collects `ticket_id`.
- **Nodes:** `intake` (FORM) → `triage` (AGENT) → `save_triage` (FUNCTION) →
  `draft` (AGENT) → `save_draft` (FUNCTION) → `approval` (FORM, human) →
  `route` (DECISION) → `commit_approved` / `commit_rejected` (FUNCTION) → `end` (END).
- **Human gate:** `approval` FORM is **assigned to a pod member**; the run suspends
  (`wait_type: HUMAN`) until that member submits. The form pre-fills the editable reply
  from the drafter's output and carries `ticket_id` so the operator UI can label it.
- **Routing safety:** the DECISION's default edge (reject) is listed first and points to
  a distinct node from the approve rule, so an un-approved decision can never silently
  route as an approval.
- **Bindings:** all input mappings use typed JMESPath bindings
  (`{type:"expression"|"literal", value}`).

---

## 12. Application (operator console)

- **Stack:** Vite + React 19 + `lemma-sdk` (TypeScript), deployed via `lemma apps deploy`.
- **URL:** https://support-desk-app.apps.lemma.work
- **Auth:** pod-authenticated (`AuthGuard`); runs as the signed-in member.
- **Surfaces (two tabs):**
  1. **Approval queue** — driven by `useWorkflowRunWaitAssignments`; each waiting reply
     renders its form from the wait payload (editable reply pre-filled) with
     **Approve & send / Reject** via `useWorkflowResume`. This is the human gate UI.
  2. **Inbox** — all tickets via `useLiveRecords` (live, no polling); each `new` ticket
     has a **"Run AI triage + draft"** button (`useWorkflowStart`).
- **Design:** queue-first, dense, calm operator console; status badges; priority chips;
  responsive to 375px.

---

## 13. End-to-End Demo Flow (verified)

1. Operator opens the app → **Inbox** → picks ticket #1 *"I was charged twice for order
   #10472"* (urgent double charge).
2. Clicks **Run AI triage + draft**.
3. `triage-agent` → `billing / urgent`; `save_triage` persists; status `triaged`.
4. `reply-drafter` searches `/knowledge`, finds **refund-policy.md**, drafts a reply
   confirming an immediate refund of the duplicate $48.00 and the 5–7 business-day
   reversal window; `save_draft` persists; status `awaiting_approval`.
5. The run **suspends** at the `approval` FORM, assigned to the operator.
6. Operator switches to **Approval queue**, reviews/edits the draft, clicks
   **Approve & send**.
7. `record_decision` writes `approved_reply`, status → **`sent`**. Run **COMPLETED**.

*(Verified live on Lemma Cloud across all three sample tickets — billing/double-charge,
shipping delay, and account/password-reset — each producing a correct, KB-grounded
draft and completing the approval loop.)*

---

## 14. Implementation Status (as-built checklist)

| Item | Status |
|---|---|
| Pod created on Lemma Cloud (`support-desk`) | ✅ |
| `tickets` table imported | ✅ |
| `/knowledge` KB uploaded + indexed | ✅ |
| `triage-agent`, `reply-drafter` imported (read-only, scoped grants) | ✅ |
| `save_triage`, `save_draft`, `record_decision` imported (with retry) | ✅ |
| `support-lifecycle` workflow imported + validated | ✅ |
| OpenAI runtime profile (BYO key) configured & verified | ✅ |
| Sample tickets seeded | ✅ |
| Full loop run → COMPLETED (sent) | ✅ |
| App built, deployed, live (`support-desk-app`) | ✅ |
| Human approval gate working in app (Approval queue tab) | ✅ |
| `ayush@gappy.ai` invited to pod (Pod Admin) | ✅ |

---

## 15. Risks, Limitations & Future Work

- **Transient backend 502s** on the function sandbox were observed; mitigated with retry.
  Future: idempotent run-resume on partial failure.
- **No live channel ingestion yet.** Add a Gmail/Slack connector or a `DATASTORE_EVENT`
  trigger so new rows auto-start the workflow.
- **"Send" is recorded, not delivered.** Wire an outbound email/connector action on
  approve to actually dispatch the reply.
- **Single shared queue.** Add assignment/ownership, SLA timers, and analytics.
- **Model choice.** `gpt-4o-mini` is cost-optimized; swap to `gpt-4o` per-pod for
  higher-stakes drafting via the runtime profile.

---

## 16. Lemma SDK Utilization (why this is a meaningful build)

This product uses Lemma the way it's intended — not as a thin chatbot wrapper:
- **Structured state** in a Table that humans and agents share.
- **RAG** over the native Files index (no external vector DB).
- **Scoped, least-privilege agents** with typed outputs.
- **Deterministic functions** for reliable, auditable writes.
- **A workflow with a real human-in-the-loop FORM gate** that suspends execution.
- **A custom app** deployed into the pod as the product surface.

That combination — durable state + non-deterministic agent judgment + deterministic
code + mandatory human authorization, in one environment — is exactly what Lemma
enables and what a generic LangChain/Pinecone/Streamlit stack would require substantial
custom plumbing to approximate.

---

*End of Business Requirements Document — Support Desk (v2.0, as-built).*
