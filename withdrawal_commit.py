"""Firestore adapter used by the pre-model withdrawal branch.

Caller injects firestore.transactional and SERVER_TIMESTAMP. All durable writes
are atomic; Gmail label removal is allowed only after created/already_recorded.
No credentials or network clients are constructed in this module.
"""

import random
import time


def commit_withdrawal(db, plan, transactional, server_timestamp):
    if plan['action'] != 'create_transfer':
        return plan['action']
    candidate = plan['transaction']
    email_id = candidate['source']['gmailMessageId']
    tx_ref = db.collection('finance_transactions').document(plan['documentId'])
    processed_ref = db.collection('processed_gmail_ids').document(email_id)
    event_ref = db.collection('processed_gmail_ids/withdrawal_events/events').document(candidate['source']['eventKey'])

    @transactional
    def write(transaction):
        processed = processed_ref.get(transaction=transaction)
        existing = tx_ref.get(transaction=transaction)
        event = event_ref.get(transaction=transaction)
        if processed.exists:
            # Old processed markers do not identify their transaction. Fail
            # closed instead of incorrectly declaring reconciliation complete.
            data = processed.to_dict()
            return 'already_recorded' if data.get('transactionId') == plan['documentId'] and existing.exists else 'hold_processed_legacy'
        if existing.exists:
            return 'hold_existing_document'
        if event.exists:
            return 'hold_possible_duplicate_event'
        transaction.create(tx_ref, candidate)
        transaction.create(event_ref, {'gmailMessageId': email_id, 'transactionId': plan['documentId']})
        transaction.create(processed_ref, {'processedAt': server_timestamp,
                                           'transactionId': plan['documentId'],
                                           'policyVersion': 'withdrawal-v1'})
        return 'created'

    # The SDK retries commit-time Aborted internally, but its retry loop has
    # no jitter and read-time Aborted escapes it. Under contention (including
    # emulator lock upgrades), all callers can exhaust those attempts together.
    # Start a fresh atomic transaction after bounded jitter, re-reading every
    # guard. Never retry permission, validation, or unknown-outcome failures.
    for attempt in range(3):
        try:
            return write(db.transaction())
        except Exception as error:
            from google.api_core.exceptions import Aborted
            retryable = isinstance(error, Aborted) or (
                isinstance(error, ValueError) and isinstance(error.__cause__, Aborted)
            )
            if not retryable or attempt == 2:
                raise
            time.sleep(random.uniform(0.2, 0.8) * (2 ** attempt))
