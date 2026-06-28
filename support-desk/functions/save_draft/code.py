#input_type_name: SaveDraftInput
#output_type_name: SaveDraftResult
#function_name: save_draft

import time

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class SaveDraftInput(BaseModel):
    ticket_id: str
    draft_reply: str
    kb_sources: str | None = None


class SaveDraftResult(BaseModel):
    ticket_id: str
    status: str


def _update_with_retry(table, record_id, payload, attempts=4):
    """Retry transient 502/Connection-refused from the function sandbox -> Lemma API."""
    last = None
    for i in range(attempts):
        try:
            return table.update(record_id, payload)
        except Exception as e:  # noqa: BLE001 - transient network/5xx
            last = e
            time.sleep(0.6 * (i + 1))
    raise last


async def save_draft(ctx: FunctionContext, data: SaveDraftInput) -> SaveDraftResult:
    """Persist the reply-drafter agent's draft onto the ticket and advance its status
    to 'awaiting_approval' so it surfaces in the human approval queue."""
    pod = Pod.from_env()
    _update_with_retry(
        pod.table("tickets"),
        data.ticket_id,
        {
            "draft_reply": data.draft_reply,
            "kb_sources": data.kb_sources or "",
            "status": "awaiting_approval",
        },
    )
    return SaveDraftResult(ticket_id=data.ticket_id, status="awaiting_approval")
