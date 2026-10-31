"""Conservative account resolution from email evidence; no network dependencies.

Last-four identifiers are evidence, not fuzzy text. Card repayments are held for
review because the destination credit card is not necessarily the funding account.
"""
import re
import unicodedata


def _normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text or '')
                   if not unicodedata.combining(c)).lower()


# Require masking or a card/account qualifier: amounts, dates and authorization
# numbers must not accidentally become card identifiers.
_SUFFIX = re.compile(
    r'(?:(?:[*•●]+|x{2,})\s*(\d{4})(?!\d)(?![\s-]+\d)|'
    r'(?:tarjeta|card|cuenta|account)(?:\s+(?:de\s+credito|de\s+debito))?'
    r'\s*(?:terminad[ao](?:\s+en)?|ending(?:\s+in)?|ultimos?\s+4\s+digitos)?'
    r'\s*[:#-]?\s*(\d{4})(?!\d)(?![\s-]+\d))', re.IGNORECASE)
_PAYMENT = re.compile(
    r'\b(?:pago\s+(?:(?:de|a)\s+)?(?:(?:tu|la|mi|una)\s+)?tarjeta|'
    r'pagaste\s+(?:(?:tu|la)\s+)?tarjeta|card\s+payment|credit\s+card\s+payment)\b')


def is_card_payment(text):
    normalized = _normalize(text)
    if _PAYMENT.search(normalized):
        return True
    # Fail closed for payment notices: destination card is not the source.
    # Only a direct purchase phrase is an exception to this broad safety gate.
    card_context = re.search(r'\b(?:tarjeta|rappicard|card)\b', normalized)
    payment_context = re.search(r'\b(?:pago|pagaste|abono|payment|repayment)\b', normalized)
    purchase = re.search(r'\b(?:pago\s+con\s+(?:(?:tu|la|mi)\s+)?tarjeta|paid\s+with\s+card)\b', normalized)
    return bool(card_context and payment_context and not purchase)


def suffixes(text):
    return set(a or b for a, b in _SUFFIX.findall(_normalize(text)))


def account_suffix(account):
    # Catalog names commonly contain an unmasked trailing suffix.
    found = re.search(r'(?<!\d)(\d{4})\s*$', str(account))
    return found.group(1) if found else None


def resolve_card(datos, email_text, accounts):
    """Never infer an account from a conflicting, absent or ambiguous identifier.

    Return a pending-review representation when evidence is insufficient. This
    is NOT `ignore`: the transaction remains visible for manual completion.
    Catalog choices and LLM comments cannot override source-email evidence.
    """
    out = dict(datos)
    if out.get('type') == 'ignore':
        return out
    observed = sorted(suffixes(email_text))
    catalog = list(dict.fromkeys(a for a in accounts if isinstance(a, str)))
    reason = 'missing_identifier'
    selected = ''
    if is_card_payment(email_text):
        reason = 'card_payment_source_unconfirmed'
    elif re.search(r'\b(?:transferencia|transfer|traslado)\b', _normalize(email_text)):
        reason = 'transfer_source_unconfirmed'
    elif len(observed) > 1:
        reason = 'multiple_identifiers'
    elif len(observed) == 1:
        matches = [a for a in catalog if account_suffix(a) == observed[0]]
        if len(matches) == 1:
            selected = matches[0]
            reason = 'unique_suffix_match'
        elif len(matches) > 1:
            reason = 'ambiguous_catalog_suffix'
        else:
            reason = 'unknown_suffix'
    out['card'] = selected
    out['cardResolution'] = {
        'status': 'resolved' if selected else 'needs_review',
        'reason': reason,
        'observedLast4': observed,
    }
    if not selected:
        note = '[Cuenta por confirmar: ' + reason + ']'
        out['comments'] = note + (' ' + str(out['comments']) if out.get('comments') else '')
    return out
