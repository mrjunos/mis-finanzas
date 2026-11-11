# Withdrawal reconciliation and idempotent imports

Withdrawals are routed before the model. Supported bank notices become a
`transfer` to Efectivo only with an explicit, evidenced alias in
`finance_settings/default.confirmedCardAliases` and both accounts in the catalog.
Example shape (synthetic values):

    {"1234": {"account": "Savings *5678", "confirmedBy": "User confirmation reference"}}

No aliases or bank accounts are created by deployment. Missing/ambiguous aliases,
unsupported formats, reversals, and legacy same-day/same-amount records are held
in `finance_import_review/<messageId>` and keep the original Gmail label. They
never become model-inferred expenses. Inspect and reconcile legacy records in
place, never create a second copy to fix classification. The review queue is
currently backend data, not a dedicated UI screen.

New imports use `finance_transactions/gmail_<messageId>` and atomically create
the processed marker. A crash before Gmail label removal therefore cannot
recreate that record. Existing processed markers remain honored. No historical
records are migrated. Different messages describing the same withdrawal event
are held for review via an event claim under the already backend-only
`processed_gmail_ids/withdrawal_events/events` subcollection. This conservative
check may hold distinct withdrawals with identical minute, amount and location;
it does not silently merge them. It is not universal cross-email deduplication.

Main and replay dry-runs do not write transactions, review records, processed
markers, Gmail labels or refreshed OAuth tokens. OAuth refresh/model calls can
still occur; dry-run is not an offline mode. Replay writes now honor message IDs
and cannot generate fresh duplicates of previously processed messages.

Transfers do not affect global cash-flow charts or expense totals. Account-level
balance bookkeeping is outside this patch; this does not execute bank transfers.

## Validation

- `npm ci && npm test && npm run lint && npm run build` (build needs Firebase web
  config; local validation used only a demo config).
- `python -m unittest discover -s tests -v` (emulator tests skip unless opted in).
- Java21, firebase-tools15.35.0, firebase-admin7.7.0 for real emulator tests:

    GCLOUD_PROJECT=demo-mis-finanzas-withdrawals RUN_FIRESTORE_EMULATOR_TESTS=1 firebase emulators:exec --only firestore --project demo-mis-finanzas-withdrawals --config firebase.emulator.json "python -m unittest discover -s tests -v"

Tests require exactly loopback8087 and the demo project; no credentials or real
Gmail/model requests. CI runs emulator tests before build/deployment. The suite
covers concurrent retries, atomic failure, label-removal retry, preserved user
edits, duplicate event holds, legacy collisions and missing aliases.

### Transaction contention

The withdrawal adapter permits three outer attempts after typed Firestore
`Aborted` failures (including SDK retry-exhaustion `ValueError` caused by
`Aborted`). Each attempt re-reads every guard in a fresh atomic transaction;
exponential jitter separates competing callers. Permission, validation and
unknown-outcome errors are not retried here. Exhaustion propagates so Gmail
remains pending. This bounds retries but does not guarantee success under
sustained contention. The emulator test retains four concurrent writers and
checks the transaction, processed marker and event claim all exist exactly once.
