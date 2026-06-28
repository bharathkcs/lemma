#!/usr/bin/env bash
# =============================================================================
# seed.sh — make the Support Desk pod demo itself.
#
# Run AFTER `lemma pods import .` (file bytes and records do NOT travel in the
# bundle). Requires the lemma CLI authenticated with the support-desk pod active
# (or pass --pod support-desk on each command / set LEMMA_POD_ID).
#
#   bash seed/seed.sh
#
# Idempotent-ish: re-running re-uploads the KB files (overwrites) and appends
# more sample tickets. Delete sample tickets in the UI if you want a clean slate.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."   # bundle root (so ./seed/knowledge resolves)

POD_FLAG="${LEMMA_POD_ID:+--pod $LEMMA_POD_ID}"

echo "→ Uploading knowledge base files to /knowledge ..."
lemma files upload ./seed/knowledge/refund-policy.md        /knowledge/refund-policy.md        $POD_FLAG
lemma files upload ./seed/knowledge/shipping-and-delivery.md /knowledge/shipping-and-delivery.md $POD_FLAG
lemma files upload ./seed/knowledge/account-and-login.md    /knowledge/account-and-login.md    $POD_FLAG
echo "  KB uploaded. (Indexing runs async: PENDING -> PROCESSING -> COMPLETED before it's searchable.)"

echo "→ Creating sample tickets ..."
lemma records create tickets $POD_FLAG --data '{
  "channel": "email",
  "customer_email": "asha@example.com",
  "customer_name": "Asha R.",
  "subject": "I was charged twice for order #10472",
  "body": "Hi, I placed one order yesterday but my card shows two identical charges of $48.00. Please refund the duplicate. This is urgent, I need the money back.",
  "status": "new"
}'

lemma records create tickets $POD_FLAG --data '{
  "channel": "form",
  "customer_email": "deepak@example.com",
  "customer_name": "Deepak M.",
  "subject": "Where is my order? Tracking has not moved in a week",
  "body": "My order shipped 8 days ago and the tracking page still says label created. It has not moved at all. Can you tell me what is going on and when it will arrive?",
  "status": "new"
}'

lemma records create tickets $POD_FLAG --data '{
  "channel": "chat",
  "customer_email": "lena@example.com",
  "customer_name": "Lena P.",
  "subject": "Cannot log in - password reset link expired",
  "body": "I tried to reset my password but the link says it expired by the time I clicked it. I never get a chance to set a new one. How do I get back into my account?",
  "status": "new"
}'

echo ""
echo "✅  Seed complete. Open the Support Desk app, or run the workflow on a ticket:"
echo "    lemma records list tickets $POD_FLAG --limit 5"
echo "    lemma workflows run support-lifecycle $POD_FLAG --data '{\"ticket_id\":\"<id-from-above>\"}'"
echo "    # the run pauses at the approval form; clear it in the app or with:"
echo "    lemma workflows runs waiting $POD_FLAG"
