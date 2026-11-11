"""Offline withdrawal policy proposal. No network, credentials or writes.

Must run before Gemini. A held withdrawal must NEVER fall through to Gemini.
Only the exact supported Bancolombia notification is auto-planned; ambiguous
withdrawals remain in the review queue. Configured aliases need user evidence.
"""
import datetime as dt
import hashlib
import re
from decimal import Decimal
from email.utils import parseaddr

BOGOTA = dt.timezone(dt.timedelta(hours=-5))
SENDERS = {
    'alertasynotificaciones@an.notificacionesbancolombia.com',
    'alertasynotificaciones@ayn.notificacionesbancolombia.com',
}
WITHDRAWAL = re.compile(r'\b(?:retiraste|retiro|retirada|withdrawal|withdrew)\b', re.I)
FAILED = re.compile(r'\b(?:rechazad[ao]|fallid[ao]|declinad[ao]|no fue exitos[ao]|reversad[ao]|reversal|failed)\b', re.I)
NOTICE = re.compile(
    r'Bancolombia:\s*Retiraste\s*(?:COP\s*)?\$\s*'
    r'(?P<amount>\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})'
    r'\s+en\s+(?P<location>[^\n]{1,100}?)\s+de tu T\.Deb\s*\*{1,4}'
    r'(?P<last4>\d{4})\s+el\s+(?P<date>\d{2}/\d{2}/\d{4})'
    r'\s+a las\s+(?P<time>\d{2}:\d{2})', re.I)


def plan_withdrawal(sender, text, email_id, accounts, aliases, existing=()):
    """Return None for non-withdrawals, hold or a pending transfer candidate.

aliases: {last4: {account: exact catalog name, confirmedBy: nonempty evidence}}.
existing: already loaded transactions for the parsed day. No global DB scan.
Never infer a different suffix or trust a model-provided account.
"""
    if not WITHDRAWAL.search(text or ''):
        return None
    def hold(reason):
        return {'action': 'hold', 'reason': reason, 'emailId': email_id}
    if not re.fullmatch(r'[a-fA-F0-9]{8,64}', email_id or ''):
        return hold('invalid_email_id')
    if parseaddr(sender)[1].lower() not in SENDERS:
        return hold('unsupported_sender')
    if FAILED.search(text):
        return hold('failed_or_reversed_notice')
    # Plain-text + HTML representations may repeat the same notice.
    matches = {tuple(m.groupdict().items()) for m in NOTICE.finditer(text)}
    if len(matches) != 1:
        return hold('ambiguous_or_unsupported_notice')
    fields = dict(matches.pop())
    amount = Decimal(fields['amount'].replace('.', '').replace(',', '.'))
    if amount <= 0:
        return hold('invalid_amount')
    try:
        when = dt.datetime.strptime(fields['date']+' '+fields['time'], '%d/%m/%Y %H:%M').replace(tzinfo=BOGOTA)
    except ValueError:
        return hold('invalid_transaction_date')
    if not isinstance(aliases, dict) or not isinstance(accounts, list) or any(not isinstance(a, str) or not a.strip() for a in accounts):
        return hold('invalid_configuration')
    alias = aliases.get(fields['last4'], {})
    if not isinstance(alias, dict):
        return hold('invalid_configuration')
    source = alias.get('account')
    if source is not None and (not isinstance(source, str) or not isinstance(alias.get('confirmedBy'), str)):
        return hold('invalid_configuration')
    if not source or not source.strip() or not alias.get('confirmedBy', '').strip():
        return hold('source_account_unconfirmed')
    if source not in accounts or 'Efectivo' not in accounts or source == 'Efectivo':
        return hold('invalid_accounts')
    date = when.strftime('%Y-%m-%d')
    event = '|'.join([date, fields['time'], str(amount), fields['last4'], fields['location'].upper()])
    event_key = hashlib.sha256(event.encode()).hexdigest()
    for tx in existing:
        provenance = tx.get('source') or {}
        if not isinstance(provenance, dict):
            return hold('invalid_existing_provenance')
        if provenance.get('gmailMessageId') == email_id:
            return {'action': 'already_recorded', 'emailId': email_id, 'transactionId': tx.get('id')}
        # Another email describing the same event is not automatically a second
        # transaction. Preserve it for reconciliation rather than discard it.
        if provenance.get('eventKey') == event_key:
            return hold('possible_duplicate_event')
        if str(tx.get('date')) == date and str(tx.get('amount')):
            try:
                same_amount = Decimal(str(tx['amount'])) == amount
            except Exception:
                return hold('invalid_existing_amount')
            if same_amount and tx.get('type') in ('debit', 'transfer'):
                return hold('legacy_same_day_amount_needs_review')
    return {
        'action': 'create_transfer',
        'documentId': 'gmail_'+email_id,
        'transaction': {
            'type': 'transfer', 'amount': float(amount), 'currency': 'COP',
            'title': 'Retiro a efectivo — '+fields['location'],
            'category': 'Financiero y Deudas', 'subcategory': '',
            'card': source, 'destinationCard': 'Efectivo',
            'context': 'personal', 'destinationContext': 'personal',
            'date': date, 'timestamp': when, 'status': 'pending',
            'comments': 'Retiro bancario, no consumo. Tarjeta *'+fields['last4']+'.',
            'cardResolution': {'status': 'resolved', 'reason': 'user_confirmed_alias',
                               'observedLast4': [fields['last4']], 'evidence': alias['confirmedBy']},
            'source': {'provider': 'gmail', 'gmailMessageId': email_id,
                       'eventKey': event_key, 'policyVersion': 'withdrawal-v1'},
        },
    }
