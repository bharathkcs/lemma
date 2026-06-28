# Support Desk — AI customer support, with a human in the loop

An **AI Support Desk** built on the Lemma SDK. Incoming customer issues are
**triaged** by an agent, a reply is **drafted** by a second agent grounded in a
knowledge base (RAG), and **every reply is held for human approval** before it is
finalized. Humans and agents operate on the same shared `tickets` table.

> Problem statement (Gappy AI hackathon): *AI Customer Support Desk for a Startup.*
> Target user: a support lead at a small startup drowning in email/form/chat issues.

## The loop

```
new ticket
   │
   ▼  AGENT triage-agent      → sets category + priority,  status = triaged
   ▼  AGENT reply-drafter     → searches /knowledge (RAG), writes draft_reply,
   │                            status = awaiting_approval
   ▼  FORM  human approval    → run PAUSES; reviewer approves / edits / rejects
   ▼  DECISION approved?
        ├─ approved → FUNCTION record_decision → approved_reply set, status = sent
        └─ rejected → FUNCTION record_decision → status = rejected (re-draft)
```

The **FORM node is the human-in-the-loop gate**: the workflow run suspends with an
`active_wait` assigned to a pod member and does not continue until a person submits the
decision. No customer reply is ever finalized by the AI alone.

## What's in the pod

| Resource | Name | Role |
| --- | --- | --- |
| Table | `tickets` | shared support queue + full lifecycle state |
| Files | `/knowledge` | refund, shipping, account policies — RAG corpus |
| Agent | `triage-agent` | classify category + priority (read/write `tickets`) |
| Agent | `reply-drafter` | draft reply grounded in `/knowledge` (read `/knowledge`, write `tickets`) |
| Function | `record_decision` | commit the human's approve/reject to the ticket |
| Workflow | `support-lifecycle` | orchestrates the loop above with the approval gate |
| App | `support-desk-app` | operator UI: inbox + approval queue (see `apps/`) |

## Setup

Prerequisite: a model provider must be configured for the pod's org (agents won't run
without one).

```bash
# 0. auth + select org
lemma auth login
lemma orgs list

# 1. create the pod shell, then import the bundle
lemma pods create support-desk --org <ORG_ID> --description "AI Support Desk"
lemma pods import . --dry-run        # validate everything
lemma pods import .                  # upsert all resources

# 2. seed: upload KB files + sample tickets (bytes/records don't travel in bundles)
LEMMA_POD_ID=<POD_ID> bash seed/seed.sh

# 3. verify each layer
lemma pods describe
lemma agents chat triage-agent "Classify: 'I was charged twice', return fields used"
lemma workflows run support-lifecycle --data '{"ticket_id":"<id>"}'   # pauses at approval
lemma workflows runs waiting                                          # the approval queue
lemma workflows runs submit-form <run-id> --data '{"approved":true}'  # approve -> sent
```

## App

The operator UI lives in `apps/support-desk-app/` (Vite + `lemma-sdk`). It shows the
ticket inbox and the approval queue, and lets a reviewer approve/edit/reject — which
resumes the paused workflow. Build/deploy:

```bash
lemma apps deploy support-desk-app ./apps/support-desk-app/source
```

## Notes / gotchas baked in

- `tickets` is **shared** (`enable_rls: false`) so the whole team (and both agents)
  see the same queue.
- Agents and the function are granted **only** what they touch (zero-access-by-default).
- The DECISION node's **default edge is listed first** (reject), with an explicit rule
  for approve, so an un-approved decision can never silently route as an approval.
- KB files are document-format markdown, so they are auto-indexed for search/RAG.
