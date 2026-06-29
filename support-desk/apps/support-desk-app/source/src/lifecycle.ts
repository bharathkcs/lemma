// ===========================================================================
// Lifecycle helpers — pure, framework-free logic for the Support Desk.
//
// Design principle: the `tickets` table is the SOURCE OF TRUTH for what needs a
// human decision. The workflow run/wait is just the engine that fills the row.
// Runs can hang, time out, or be cancelled (we saw this in production: an AGENT
// wait stuck ACTIVE left a ticket triaged-but-undrafted, and a cancelled run
// left a ticket awaiting_approval with no live wait to resume). The UI must
// therefore key off ticket.status and treat a live wait as an *enrichment*, not
// a precondition. Everything here is unit-testable without React.
// ===========================================================================

export type TicketStatus =
  | 'new'
  | 'triaged'
  | 'drafted'
  | 'awaiting_approval'
  | 'sent'
  | 'rejected'

export interface Ticket {
  id: string
  number?: number
  channel?: string
  customer_name?: string
  customer_email?: string
  subject?: string
  body?: string
  category?: string
  priority?: string
  triage_reason?: string
  draft_reply?: string | null
  kb_sources?: string | null
  approved_reply?: string | null
  reviewer_notes?: string | null
  status?: TicketStatus
  created_at?: string
  updated_at?: string
  run_id?: string | null
  [k: string]: unknown
}

/** A workflow run that is WAITING on a HUMAN approval form, as returned by
 *  useWorkflowRunWaitAssignments. We read it defensively — shapes drift. */
export interface WaitAssignment {
  run?: { id?: string; status?: string }
  wait?: {
    id?: string
    run_id?: string
    node_id?: string
    status?: string
    wait_type?: string
    payload?: {
      input_schema?: {
        properties?: Record<string, { default?: unknown }>
      }
    }
  }
}

export const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  triaged: 'Triaged',
  drafted: 'Drafted',
  awaiting_approval: 'Awaiting approval',
  sent: 'Sent',
  rejected: 'Rejected',
}

/** Pull the ticket_id a HUMAN approval wait is bound to, from its form schema. */
export function waitTicketId(a: WaitAssignment): string | undefined {
  const def = a.wait?.payload?.input_schema?.properties?.ticket_id?.default
  return typeof def === 'string' ? def : undefined
}

/** The drafted reply a wait carries as the form default (falls back to row). */
export function waitDefaultReply(a: WaitAssignment, ticket?: Ticket): string {
  const def = a.wait?.payload?.input_schema?.properties?.final_reply?.default
  if (typeof def === 'string' && def.length > 0) return def
  return ticket?.draft_reply ?? ''
}

/** Index live HUMAN approval waits by the ticket they belong to. Only ACTIVE
 *  human waits are resumable; anything else we ignore so a stale wait never
 *  shadows a row that actually needs a fresh decision. */
export function indexWaitsByTicket(
  assignments: readonly WaitAssignment[],
): Map<string, WaitAssignment> {
  const m = new Map<string, WaitAssignment>()
  for (const a of assignments) {
    const isHuman = (a.wait?.wait_type ?? 'HUMAN') === 'HUMAN'
    const isActive = (a.wait?.status ?? 'ACTIVE') === 'ACTIVE'
    if (!isHuman || !isActive) continue
    const tid = waitTicketId(a)
    if (tid) m.set(tid, a)
  }
  return m
}

/** A row needing a human decision. `wait` present => resume the workflow;
 *  absent => the run is gone, commit the decision directly via record_decision. */
export interface ApprovalItem {
  ticket: Ticket
  wait?: WaitAssignment
  /** true when there is no live workflow wait — we commit directly. */
  orphaned: boolean
}

/** The approval queue, source-of-truth first: every awaiting_approval ticket,
 *  newest first, each enriched with its live wait when one still exists. */
export function buildApprovalQueue(
  tickets: readonly Ticket[],
  assignments: readonly WaitAssignment[],
): ApprovalItem[] {
  const waitsByTicket = indexWaitsByTicket(assignments)
  return tickets
    .filter((t) => t.status === 'awaiting_approval')
    .sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
    )
    .map((ticket) => {
      const wait = waitsByTicket.get(ticket.id)
      return { ticket, wait, orphaned: !wait }
    })
}

/** Tickets whose AI pipeline started but never produced a draft — i.e. a run
 *  hung/cancelled mid-flight (status triaged or drafted but no draft_reply).
 *  These get a one-click "Retry AI" recovery in the inbox. */
export function isStalledMidPipeline(t: Ticket): boolean {
  if (t.status === 'triaged') return true
  if (t.status === 'drafted' && !t.draft_reply) return true
  return false
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return 'Unexpected error'
  }
}
