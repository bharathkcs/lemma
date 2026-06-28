#input_type_name: RecordDecisionInput
#output_type_name: RecordDecisionResult
#function_name: record_decision

import time

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


def _retry(fn, attempts=4):
    """Retry transient 502/Connection-refused from the function sandbox -> Lemma API."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - transient network/5xx
            last = e
            time.sleep(0.6 * (i + 1))
    raise last


class RecordDecisionInput(BaseModel):
    ticket_id: str
    approved: bool
    # The reviewer may edit the drafted reply before approving; if omitted we fall
    # back to the agent's draft already on the row.
    final_reply: str | None = None
    reviewer_notes: str | None = None


class RecordDecisionResult(BaseModel):
    ticket_id: str
    status: str


async def record_decision(ctx: FunctionContext, data: RecordDecisionInput) -> RecordDecisionResult:
    """Commit the human reviewer's decision to the ticket.

    Approved -> status 'sent', approved_reply = edited reply (or the existing draft).
    Rejected -> status 'rejected', so the reply-drafter can be re-run with feedback.
    This is the deterministic "commit" step of the approval gate.
    """
    pod = Pod.from_env()
    tickets = pod.table("tickets")

    ticket = _retry(lambda: tickets.get(data.ticket_id))

    if data.approved:
        approved_reply = data.final_reply or ticket.get("draft_reply") or ""
        update = {
            "status": "sent",
            "approved_reply": approved_reply,
        }
    else:
        update = {"status": "rejected"}

    if data.reviewer_notes:
        update["reviewer_notes"] = data.reviewer_notes

    _retry(lambda: tickets.update(data.ticket_id, update))
    return RecordDecisionResult(ticket_id=data.ticket_id, status=update["status"])
