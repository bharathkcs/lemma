import React, { useCallback, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  AuthGuard,
  useCurrentUser,
  useLiveRecords,
  useWorkflowStart,
  useWorkflowRunWaitAssignments,
  useWorkflowResume,
  useCreateRecord,
  useFunctionRun,
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
  Plus,
  X,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { lemmaClient } from './lemma-client'
import {
  type Ticket,
  type ApprovalItem,
  type WaitAssignment,
  STATUS_LABEL,
  buildApprovalQueue,
  waitDefaultReply,
  isStalledMidPipeline,
  errMsg,
} from './lifecycle'
import './styles.css'

const WORKFLOW_NAME = 'support-lifecycle'
const COMMIT_FUNCTION = 'record_decision'
const POD_ID = lemmaClient.podId

const queryClient = new QueryClient()

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? 'new'
  return <span className={`badge badge-${s}`}>{STATUS_LABEL[s] ?? s}</span>
}

function PriorityDot({ priority }: { priority?: string }) {
  if (!priority) return null
  return <span className={`prio prio-${priority}`}>{priority}</span>
}

// ===========================================================================
// APPROVAL CARD
// Two commit paths, picked per ticket so a dead run never blocks a decision:
//   • LIVE wait present  -> resume the workflow (record_decision runs in-flow)
//   • orphaned (no wait) -> call record_decision directly, then refresh
// Either way the reviewer edits the reply and the row advances to sent/rejected.
// ===========================================================================
function ApprovalCard({ item, onDone }: { item: ApprovalItem; onDone: () => void }) {
  const { ticket, wait, orphaned } = item

  const runId = wait?.run?.id ?? wait?.wait?.run_id ?? ''
  const nodeId = wait?.wait?.node_id ?? ''
  const defaultReply = waitDefaultReply(wait ?? ({} as WaitAssignment), ticket)

  const { resume } = useWorkflowResume({ client: lemmaClient, podId: POD_ID, runId })
  const commit = useFunctionRun({ client: lemmaClient, podId: POD_ID, functionName: COMMIT_FUNCTION })

  const [reply, setReply] = useState(defaultReply)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<false | 'approve' | 'reject'>(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(approved: boolean) {
    setBusy(approved ? 'approve' : 'reject')
    setError(null)
    try {
      if (!orphaned && runId && nodeId) {
        // Preferred path: resume the paused workflow run through its form.
        await resume(
          { approved, final_reply: reply, reviewer_notes: notes, ticket_id: ticket.id },
          { runId, nodeId },
        )
      } else {
        // Recovery path: the run is gone. Commit the decision deterministically.
        await commit.start({
          ticket_id: ticket.id,
          approved,
          final_reply: reply,
          reviewer_notes: notes,
        })
      }
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
        <span className="by">
          #{ticket.number} · {ticket.subject}
        </span>
        {ticket.priority ? <PriorityDot priority={ticket.priority} /> : null}
        {ticket.category && ticket.category !== 'other' ? (
          <span className="chip">{ticket.category}</span>
        ) : null}
      </div>

      {orphaned ? (
        <div className="notice">
          <AlertTriangle size={14} /> The original workflow run is no longer
          active — your decision will be committed directly and the reply sent.
        </div>
      ) : null}

      {ticket.body ? (
        <div className="quote">
          <span className="quote-label">Customer wrote:</span> {ticket.body}
        </div>
      ) : null}

      {ticket.kb_sources ? (
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
        <button className="btn approve" disabled={!!busy} onClick={() => decide(true)}>
          {busy === 'approve' ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
          {busy === 'approve' ? 'Sending…' : 'Approve & send'}
        </button>
        <button className="btn reject" disabled={!!busy} onClick={() => decide(false)}>
          {busy === 'reject' ? <Loader2 size={16} className="spin" /> : <XCircle size={16} />}
          {busy === 'reject' ? 'Rejecting…' : 'Reject'}
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
  tickets,
  assignments,
  isLoading,
  error,
  onRetry,
  onChanged,
}: {
  tickets: Ticket[]
  assignments: WaitAssignment[]
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onChanged: () => void
}) {
  const queue = useMemo(
    () => buildApprovalQueue(tickets, assignments),
    [tickets, assignments],
  )

  if (isLoading)
    return (
      <div className="empty">
        <Loader2 size={32} className="spin" />
        <p className="muted">Loading approval queue…</p>
      </div>
    )

  if (error)
    return (
      <div className="empty">
        <AlertTriangle size={36} />
        <p>Couldn’t load the approval queue.</p>
        <p className="muted">{errMsg(error)}</p>
        <button className="btn" onClick={onRetry}>
          <RotateCcw size={15} /> Try again
        </button>
      </div>
    )

  if (!queue.length)
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
      {queue.map((item) => (
        <ApprovalCard key={item.ticket.id} item={item} onDone={onChanged} />
      ))}
    </div>
  )
}

// ===========================================================================
// INBOX — every ticket. "Run AI" on new ones; "Retry AI" on stalled ones.
// ===========================================================================
function TicketCard({ ticket, onRan }: { ticket: Ticket; onRan: () => void }) {
  const { start, isStarting, error } = useWorkflowStart({
    client: lemmaClient,
    podId: POD_ID,
    workflowName: WORKFLOW_NAME,
  })
  const [localErr, setLocalErr] = useState<string | null>(null)

  const stalled = isStalledMidPipeline(ticket)

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

      {ticket.status === 'rejected' ? (
        <p className="hint reject-hint">
          <XCircle size={13} /> Rejected{ticket.reviewer_notes ? ` — ${ticket.reviewer_notes}` : ''}. Re-run AI to draft again.
        </p>
      ) : null}

      {ticket.status === 'new' ? (
        <div className="actions">
          <button className="btn primary" disabled={isStarting} onClick={run}>
            {isStarting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            {isStarting ? 'Running…' : 'Run AI triage + draft'}
          </button>
        </div>
      ) : stalled ? (
        <>
          <div className="notice">
            <AlertTriangle size={14} /> This ticket was triaged but the draft didn’t
            finish — the AI run likely stalled. Re-run it to produce a reply.
          </div>
          <div className="actions">
            <button className="btn primary" disabled={isStarting} onClick={run}>
              {isStarting ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
              {isStarting ? 'Re-running…' : 'Retry AI triage + draft'}
            </button>
          </div>
        </>
      ) : ticket.status === 'awaiting_approval' ? (
        <p className="hint">
          <ShieldCheck size={13} /> Drafted — see the <b>Approval queue</b> tab to approve.
        </p>
      ) : ticket.status === 'rejected' ? (
        <div className="actions">
          <button className="btn" disabled={isStarting} onClick={run}>
            {isStarting ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
            {isStarting ? 'Re-running…' : 'Re-run AI'}
          </button>
        </div>
      ) : null}

      {(localErr || error) && <div className="alert">{localErr || errMsg(error)}</div>}
    </section>
  )
}

// ===========================================================================
// NEW TICKET
// ===========================================================================
const CHANNELS = ['email', 'form', 'chat', 'slack'] as const

function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const { create, isSubmitting, error } = useCreateRecord({
    client: lemmaClient,
    podId: POD_ID,
    tableName: 'tickets',
  })

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('email')
  const [localErr, setLocalErr] = useState<string | null>(null)

  function clearForm() {
    setSubject('')
    setBody('')
    setName('')
    setEmail('')
    setChannel('email')
    setLocalErr(null)
  }

  async function submit() {
    setLocalErr(null)
    if (!subject.trim() || !body.trim()) {
      setLocalErr('Subject and message are required.')
      return
    }
    try {
      await create({
        subject: subject.trim(),
        body: body.trim(),
        customer_name: name.trim() || undefined,
        customer_email: email.trim() || undefined,
        channel,
        status: 'new',
      })
      clearForm()
      setOpen(false)
      onCreated()
    } catch (e) {
      setLocalErr(errMsg(e))
    }
  }

  if (!open) {
    return (
      <button className="btn primary new-ticket-btn" onClick={() => setOpen(true)}>
        <Plus size={16} /> New ticket
      </button>
    )
  }

  return (
    <section className="card new-ticket-card">
      <div className="card-title">
        <Plus size={15} /> New customer ticket
        <button
          className="icon-btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            setOpen(false)
            clearForm()
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <label className="field-label">Subject *</label>
      <input
        className="notes"
        placeholder="e.g. I was charged twice for my order"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <label className="field-label">Customer message *</label>
      <textarea
        className="reply-edit"
        rows={5}
        placeholder="Paste the customer's complaint here…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="form-row">
        <div className="form-col">
          <label className="field-label">Customer name</label>
          <input
            className="notes"
            placeholder="Asha R."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-col">
          <label className="field-label">Customer email</label>
          <input
            className="notes"
            placeholder="asha@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-col">
          <label className="field-label">Channel</label>
          <select
            className="notes select"
            value={channel}
            onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={isSubmitting} onClick={submit}>
          {isSubmitting ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          {isSubmitting ? 'Adding…' : 'Add ticket'}
        </button>
        <button
          className="btn"
          disabled={isSubmitting}
          onClick={() => {
            setOpen(false)
            clearForm()
          }}
        >
          Cancel
        </button>
      </div>
      <p className="hint">
        <Sparkles size={13} /> Added as a <b>New</b> ticket — then click “Run AI triage +
        draft”.
      </p>
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

  const {
    records,
    isLoading: ticketsLoading,
    error: ticketsError,
    refresh,
    liveStatus,
  } = useLiveRecords<Ticket>({
    client: lemmaClient,
    podId: POD_ID,
    tableName: 'tickets',
    limit: 100,
    sort: [{ field: 'created_at', direction: 'desc' }],
  })

  const waits = useWorkflowRunWaitAssignments({ client: lemmaClient, podId: POD_ID })

  const sortedTickets = useMemo(
    () =>
      [...records].sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
      ),
    [records],
  )

  // Queue count is source-of-truth (rows awaiting approval), not the fragile
  // live-wait count — so the badge is right even if a run was cancelled.
  const counts = useMemo(() => {
    let open = 0
    let sent = 0
    let waiting = 0
    for (const t of records) {
      if (t.status === 'sent') sent++
      else open++
      if (t.status === 'awaiting_approval') waiting++
    }
    return { open, sent, waiting }
  }, [records])

  const reloadAll = useCallback(() => {
    void refresh()
    void waits.refresh()
  }, [refresh, waits])

  // Combined refresh-pending state for the toolbar button.
  const refreshing = ticketsLoading || waits.isLoading

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
          <span className={`live live-${liveStatus}`} title={`live: ${liveStatus}`} />
          <button className="utility" onClick={reloadAll} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
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
          <Inbox size={15} /> Inbox{' '}
          <span className="tab-badge muted-badge">{records.length}</span>
        </button>
      </div>

      <main className="stage">
        {tab === 'queue' ? (
          <ApprovalQueue
            tickets={records}
            assignments={waits.assignments as WaitAssignment[]}
            // Only block on the *first* load; never strand the queue if a row
            // already needs approval. Tickets drive it, waits enrich it.
            isLoading={
              waits.isLoading && waits.assignments.length === 0 && counts.waiting === 0
                ? ticketsLoading && records.length === 0
                : false
            }
            error={waits.error && counts.waiting === 0 ? waits.error : null}
            onRetry={reloadAll}
            onChanged={reloadAll}
          />
        ) : (
          <div className="detail">
            <NewTicketForm onCreated={reloadAll} />
            {ticketsError && records.length === 0 ? (
              <div className="empty">
                <AlertTriangle size={36} />
                <p>Couldn’t load tickets.</p>
                <p className="muted">{errMsg(ticketsError)}</p>
                <button className="btn" onClick={reloadAll}>
                  <RotateCcw size={15} /> Try again
                </button>
              </div>
            ) : ticketsLoading && records.length === 0 ? (
              <div className="empty">
                <Loader2 size={32} className="spin" />
                <p className="muted">Loading tickets…</p>
              </div>
            ) : records.length === 0 ? (
              <p className="muted pad">No tickets yet. Use “New ticket” above to add one.</p>
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
