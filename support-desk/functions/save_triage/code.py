#input_type_name: SaveTriageInput
#output_type_name: SaveTriageResult
#function_name: save_triage

import time

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class SaveTriageInput(BaseModel):
    ticket_id: str
    category: str
    priority: str
    triage_reason: str | None = None


class SaveTriageResult(BaseModel):
    ticket_id: str
    status: str


def _update_with_retry(table, record_id, payload, attempts=4):
    """The function sandbox occasionally gets a transient 502/Connection refused
    reaching the Lemma API. Retry with backoff so a flaky call doesn't fail the run."""
    last = None
    for i in range(attempts):
        try:
            return table.update(record_id, payload)
        except Exception as e:  # noqa: BLE001 - transient network/5xx
            last = e
            time.sleep(0.6 * (i + 1))
    raise last


async def save_triage(ctx: FunctionContext, data: SaveTriageInput) -> SaveTriageResult:
    """Persist the triage agent's classification onto the ticket and advance its
    status to 'triaged'. Deterministic write so the pipeline never depends on the
    LLM emitting a nested write payload."""
    pod = Pod.from_env()
    _update_with_retry(
        pod.table("tickets"),
        data.ticket_id,
        {
            "category": data.category,
            "priority": data.priority,
            "triage_reason": data.triage_reason or "",
            "status": "triaged",
        },
    )
    return SaveTriageResult(ticket_id=data.ticket_id, status="triaged")
