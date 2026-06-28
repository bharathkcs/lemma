import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  AuthGuard,
  useCurrentUser,
  useLiveRecords,
  useWorkflowStart,
  useWorkflowRunWaitAssignments,
  useWorkflowResume,
} from 'lemma-sdk/react'
import {
  Headset,
  RefreshCw,
  Sparkles,
  Bot,
  PenLine,
  ShieldCheck,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { lemmaClient } from './lemma-client'
import './styles.css'

const WORKFLOW_NAME = 'support-lifecycle'
const POD_ID = lemmaClient.podId

const queryClient = new QueryClient()

interface Ticket {
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
  draft_reply?: string
  kb_sources?: string
  approved_reply?: string
  reviewer_notes?: string
  status?: string
  created_at?: string
  [k: string]: unknown
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  triaged: 'Triaged',
  drafted: 'Drafted',
  awaiting_approval: 'Awaiting approval',
  sent: 'Sent',
  rejected: 'Rejected',
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? 'new'
  return <span className={`badge badge-${s}`}>{STATUS_LABEL[s] ?? s}</span>
}

function PriorityDot({ priority }: { priority?: string }) {
  if (!priority) return null
  return <span className={`prio prio-${priority}`}>{priority}</span>
}

// ===========================================================================
// APPROVAL QUEUE — driven entirely by the workflow waiting assignments.
// Each waiting run carries its own form schema (with the drafted reply as the
// default), so we render straight from it. No fragile ticket<->run matching.
// ===========================================================================
function ApprovalCard({
  assignment,
  ticketsById,
  onDone,
}: {
  assignment: any
  ticketsById: Map<string, Ticket>
  onDone: () => void
}) {
  const runId: string = assignment.run?.id ?? assignment.wait?.run_id
  const nodeId: string = assignment.wait?.node_id
  const props = assignment.wait?.payload?.input_schema?.properties ?? {}

  const ticketId: string | undefined = props.ticket_id?.default
  const ticket = ticketId ? ticketsById.get(ticketId) : undefined
  const defaultReply: string = props.final_reply?.default ?? ticket?.draft_reply ?? ''

  const { resume } = useWorkflowResume({ client: lemmaClient, podId: POD_ID, runId })
  const [reply, setReply] = useState(defaultReply)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(approved: boolean) {
    setBusy(true)
    setError(null)
    try {
      await resume(
        { approved, final_reply: reply, reviewer_notes: notes, ticket_id: ticketId },
        { runId, nodeId },
      )
      onDone()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card approval-card">
      <div className="card-title">
        <ShieldCheck size={15} /> Awaiting your approval
        {ticket ? (
          <span className="by">
            #{ticket.number} · {ticket.subject}
          </span>
        ) : null}
        {ticket?.priority ? <PriorityDot priority={ticket.priority} /> : null}
      </div>

      {ticket?.body ? (
        <div className="quote">
          <span className="quote-label">Customer wrote:</span> {ticket.body}
        </div>
      ) : null}

      {ticket?.kb_sources ? (
        <p className="src-line">
          <Bot size={13} /> Drafted from: {ticket.kb_sources}
        </p>
      ) : null}

      <label className="field-label">
        <PenLine size={13} /> Reply (edit before sending)
      </label>
      <textarea
        className="reply-edit"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={12}
      />
      <input
        className="notes"
        placeholder="Reviewer notes / feedback (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="actions">
        <button className="btn approve" disabled={busy} onClick={() => decide(true)}>
          <CheckCircle2 size={16} /> {busy ? 'Sending…' : 'Approve & send'}
        </button>
        <button className="btn reject" disabled={busy} onClick={() => decide(false)}>
          <XCircle size={16} /> Reject
        </button>
      </div>
      <p className="hint">
        <ShieldCheck size={13} /> Nothing is sent to the customer until you approve.
      </p>
      {error ? <div className="alert">{error}</div> : null}
    </section>
  )
}

function ApprovalQueue({
  ticketsById,
  onChanged,
}: {
  ticketsById: Map<string, Ticket>
  onChanged: () => void
}) {
  const { assignments, isLoading, error, refresh } = useWorkflowRunWaitAssignments({
    client: lemmaClient,
    podId: POD_ID,
  })

  function done() {
    void refresh()
    onChanged()
  }

  if (isLoading)
    return <p className="muted pad">Loading approval queue…</p>
  if (error) return <div className="alert">{errMsg(error)}</div>
  if (!assignments.length)
    return (
      <div className="empty">
        <CheckCircle2 size={40} />
        <p>No replies waiting for approval.</p>
        <p className="muted">
          Go to the Inbox, pick a <b>New</b> ticket, and click “Run AI triage + draft”.
        </p>
      </div>
    )

  return (
    <div className="detail">
      {assignments.map((a: any) => (
        <ApprovalCard
          key={a.wait?.id ?? a.run?.id}
          assignment={a}
          ticketsById={ticketsById}
          onDone={done}
        />
      ))}
    </div>
  )
}

// ===========================================================================
// INBOX — all tickets; "Run AI" on new ones.
// ===========================================================================
function TicketCard({ ticket, onRan }: { ticket: Ticket; onRan: () => void }) {
  const { start, isStarting, error } = useWorkflowStart({
    client: lemmaClient,
    podId: POD_ID,
    workflowName: WORKFLOW_NAME,
  })
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function run() {
    setLocalErr(null)
    try {
      await start({ ticket_id: ticket.id })
      onRan()
    } catch (e) {
      setLocalErr(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-title">
        <span className="ticket-num mono">#{ticket.number}</span>
        {ticket.subject}
        <span style={{ marginLeft: 'auto' }}>
          <StatusBadge status={ticket.status} />
        </span>
      </div>
      <div className="ticket-meta">
        <span className="mono">{ticket.customer_name ?? ticket.customer_email}</span>
        <PriorityDot priority={ticket.priority} />
        {ticket.category && ticket.category !== 'other' ? (
          <span className="chip">{ticket.category}</span>
        ) : null}
      </div>
      <p className="body-text">{ticket.body}</p>

      {ticket.status === 'sent' && ticket.approved_reply ? (
        <div className="quote ok">
          <span className="quote-label">Sent reply:</span> {ticket.approved_reply}
        </div>
      ) : null}

      {ticket.status === 'new' ? (
        <div className="actions">
          <button className="btn primary" disabled={isStarting} onClick={run}>
            <Sparkles size={16} /> {isStarting ? 'Running…' : 'Run AI triage + draft'}
          </button>
        </div>
      ) : ticket.status === 'awaiting_approval' ? (
        <p className="hint">
          <ShieldCheck size={13} /> Drafted — see the <b>Approval queue</b> tab to approve.
        </p>
      ) : null}

      {(localErr || error) && <div className="alert">{localErr || errMsg(error)}</div>}
    </section>
  )
}

// ===========================================================================
// App shell
// ===========================================================================
function App() {
  const { user } = useCurrentUser({ client: lemmaClient })
  const [tab, setTab] = useState<'queue' | 'inbox'>('queue')

  const { records, isLoading, refresh, liveStatus } = useLiveRecords<Ticket>({
    client: lemmaClient,
    podId: POD_ID,
    tableName: 'tickets',
    limit: 100,
    sort: [{ field: 'created_at', direction: 'desc' }],
  })

  const waits = useWorkflowRunWaitAssignments({ client: lemmaClient, podId: POD_ID })

  const ticketsById = useMemo(() => {
    const m = new Map<string, Ticket>()
    for (const t of records) m.set(t.id, t)
    return m
  }, [records])

  const sortedTickets = useMemo(
    () =>
      [...records].sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
      ),
    [records],
  )

  const counts = useMemo(() => {
    let open = 0
    let sent = 0
    for (const t of records) {
      if (t.status === 'sent') sent++
      else open++
    }
    return { open, sent, waiting: waits.assignments.length }
  }, [records, waits.assignments.length])

  function reloadAll() {
    void refresh()
    void waits.refresh()
  }

  return (
    <div className="console">
      <header className="topbar">
        <div className="brand">
          <Headset size={22} />
          <div>
            <p>Support Desk</p>
            <span>AI triage + draft · human approval</span>
          </div>
        </div>
        <div className="top-stats">
          <span className="stat">
            <ShieldCheck size={14} /> {counts.waiting} to approve
          </span>
          <span className="stat">
            <Clock size={14} /> {counts.open} open
          </span>
          <span className="stat">
            <CheckCircle2 size={14} /> {counts.sent} sent
          </span>
          <span className={`live live-${liveStatus}`} />
          <button className="utility" onClick={reloadAll} disabled={isLoading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${tab === 'queue' ? 'active' : ''}`}
          onClick={() => setTab('queue')}
        >
          <ShieldCheck size={15} /> Approval queue
          {counts.waiting > 0 ? <span className="tab-badge">{counts.waiting}</span> : null}
        </button>
        <button
          className={`tab ${tab === 'inbox' ? 'active' : ''}`}
          onClick={() => setTab('inbox')}
        >
          <Inbox size={15} /> Inbox <span className="tab-badge muted-badge">{records.length}</span>
        </button>
      </div>

      <main className="stage">
        {tab === 'queue' ? (
          <ApprovalQueue ticketsById={ticketsById} onChanged={reloadAll} />
        ) : (
          <div className="detail">
            {isLoading && records.length === 0 ? (
              <p className="muted pad">Loading tickets…</p>
            ) : records.length === 0 ? (
              <p className="muted pad">No tickets yet.</p>
            ) : (
              sortedTickets.map((t) => (
                <TicketCard key={t.id} ticket={t} onRan={reloadAll} />
              ))
            )}
          </div>
        )}
      </main>

      <footer className="footer mono">
        signed in as {user?.email ?? '—'} · pod {POD_ID}
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard
        client={lemmaClient}
        loadingFallback={
          <div className="console">
            <div className="empty">Checking access…</div>
          </div>
        }
      >
        <App />
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)
