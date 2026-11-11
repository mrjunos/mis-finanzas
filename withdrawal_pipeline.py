"""Withdrawal branch, called before the model. No credentials constructed here."""
from withdrawal_policy import plan_withdrawal
from withdrawal_commit import commit_withdrawal


def process_withdrawal(db, sender, body, email_id, transactional, server_timestamp, dry_run=False):
    # Cheap first pass detects whether this is a withdrawal. Empty settings make
    # it fail closed without generating a model classification.
    probe = plan_withdrawal(sender, body, email_id, [], {})
    if probe is None:
        return None
    settings = db.collection('finance_settings').document('default').get()
    config = settings.to_dict() if settings.exists else {}
    if not isinstance(config, dict):
        config = {}
    args = (sender, body, email_id, config.get('accounts', []), config.get('confirmedCardAliases', {}))
    plan = plan_withdrawal(*args)
    if plan['action'] == 'create_transfer':
        day = plan['transaction']['date']
        existing = [dict(d.to_dict(), id=d.id) for d in
                    db.collection('finance_transactions').where('date', '==', day).get()]
        plan = plan_withdrawal(*args, existing=existing)
    if dry_run:
        return {'outcome': 'dry_run', 'plan': plan, 'removeLabel': False}
    if plan['action'] == 'already_recorded':
        # The candidate has provenance, but the processed marker may be absent;
        # do not silently repair/mutate legacy data in this branch.
        outcome = 'hold_existing_record_needs_reconciliation'
    elif plan['action'] == 'create_transfer':
        outcome = commit_withdrawal(db, plan, transactional, server_timestamp)
    else:
        outcome = 'hold_' + plan['reason']
    if outcome not in ('created', 'already_recorded'):
        # Original Gmail label stays. Deterministic review doc avoids queue spam.
        db.collection('finance_import_review').document(email_id).set({
            'gmailMessageId': email_id, 'reason': outcome,
            'policyVersion': 'withdrawal-v1', 'updatedAt': server_timestamp,
        }, merge=True)
    return {'outcome': outcome, 'removeLabel': outcome in ('created', 'already_recorded')}
