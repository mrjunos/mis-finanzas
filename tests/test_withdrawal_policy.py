import unittest
from withdrawal_policy import plan_withdrawal
from withdrawal_commit import commit_withdrawal

EMAIL = 'abc123456789abcd'
TEXT = 'Bancolombia: Retiraste $100.000,00 en TEST_ATM de tu T.Deb **5996 el 10/11/2026 a las 07:50.'
SENDER = 'Alertas y Notificaciones <alertasynotificaciones@an.notificacionesbancolombia.com>'
ACCOUNTS = ['Bancolombia Debit *2823', 'Efectivo']
ALIASES = {'5996': {'account': ACCOUNTS[0], 'confirmedBy': 'synthetic user confirmation for test account alias'}}


class PolicyTests(unittest.TestCase):
    def plan(self, **kw):
        args = dict(sender=SENDER, text=TEXT, email_id=EMAIL, accounts=ACCOUNTS, aliases=ALIASES)
        args.update(kw)
        return plan_withdrawal(**args)

    def test_exact_case_is_transfer_not_consumption(self):
        p = self.plan(); t = p['transaction']
        self.assertEqual(p['action'], 'create_transfer')
        self.assertEqual((t['type'], t['amount'], t['card'], t['destinationCard']), ('transfer', 100000, ACCOUNTS[0], 'Efectivo'))
        self.assertEqual(t['timestamp'].isoformat(), '2026-11-10T07:50:00-05:00')
        self.assertEqual(t['status'], 'pending')
        self.assertEqual(t['source']['gmailMessageId'], EMAIL)

    def test_no_alias_never_infers_2823(self):
        self.assertEqual(self.plan(aliases={})['reason'], 'source_account_unconfirmed')

    def test_alias_requires_evidence(self):
        self.assertEqual(self.plan(aliases={'5996': {'account': ACCOUNTS[0]}})['action'], 'hold')

    def test_account_must_exist(self):
        self.assertEqual(self.plan(accounts=['Efectivo'])['reason'], 'invalid_accounts')

    def test_malformed_configuration_is_held(self):
        for aliases, accounts in [(None, ACCOUNTS), ([], ACCOUNTS), (ALIASES, None),
                                  (ALIASES, {}), ({'5996': None}, ACCOUNTS),
                                  ({'5996': {'account': {'name': 'bad'}, 'confirmedBy': True}}, [{'name':'bad'}, 'Efectivo'])]:
            self.assertEqual(self.plan(aliases=aliases, accounts=accounts)['action'], 'hold')

    def test_duplicate_mime_allowed(self):
        self.assertEqual(self.plan(text=TEXT+'\n'+TEXT)['action'], 'create_transfer')

    def test_two_notices_held(self):
        self.assertEqual(self.plan(text=TEXT+'\n'+TEXT.replace('100.000','200.000'))['action'], 'hold')

    def test_failed_reversed_and_unrecognized_are_held(self):
        for txt in (TEXT+' Rechazada', TEXT+' reversada', 'Retiro de cajero $100.000', TEXT.replace('10/11/2026','40/11/2026')):
            self.assertEqual(self.plan(text=txt)['action'], 'hold')

    def test_sender_cannot_use_display_name_or_substring(self):
        for sender in ('alertasynotificaciones@an.notificacionesbancolombia.com.evil.test', 'Bancolombia <a@evil.test>'):
            self.assertEqual(self.plan(sender=sender)['reason'], 'unsupported_sender')

    def test_uber_and_regular_purchase_unaffected(self):
        self.assertIsNone(self.plan(text='Compraste COP9.238,00 en UBER*RIDES con tu T.Cred *7761'))

    def test_legacy_collision_held(self):
        self.assertEqual(self.plan(existing=[{'date':'2026-11-10','amount':100000,'type':'debit'}])['action'], 'hold')

    def test_same_email_no_new_record(self):
        t = self.plan()['transaction']; t['id']='gmail_'+EMAIL
        self.assertEqual(self.plan(existing=[t])['action'], 'already_recorded')

    def test_different_email_same_event_held(self):
        t = self.plan()['transaction']
        self.assertEqual(self.plan(email_id='abc123456789abce',existing=[t])['reason'],'possible_duplicate_event')


class Snapshot:
    def __init__(self, data): self.data = data; self.exists = data is not None
    def to_dict(self): return self.data

class Ref:
    def __init__(self, db, key): self.db=db; self.key=key
    def get(self, transaction): return Snapshot(self.db.data.get(self.key))

class Collection:
    def __init__(self, db, name): self.db=db; self.name=name
    def document(self, key): return Ref(self.db, self.name+'/'+key)

class FakeDB:
    def __init__(self): self.data={}; self.staged=[]
    def collection(self, name): return Collection(self,name)
    def transaction(self): self.staged=[]; return self
    def create(self, ref, data):
        if ref.key in self.data: raise RuntimeError('already exists')
        self.staged.append((ref.key,data))
    def atomic(self, fn):
        def wrapped(transaction):
            result=fn(transaction)
            self.data.update(self.staged)
            return result
        return wrapped


class CommitTests(unittest.TestCase):
    def setUp(self):
        self.db=FakeDB()
        self.plan=plan_withdrawal(SENDER,TEXT,EMAIL,ACCOUNTS,ALIASES)
    def run_commit(self): return commit_withdrawal(self.db,self.plan,self.db.atomic,'server-now')
    def test_retries_do_not_duplicate_or_overwrite(self):
        self.assertEqual(self.run_commit(),'created')
        self.assertEqual(len(self.db.data),3)
        self.db.data['finance_transactions/gmail_'+EMAIL]['title']='User edit'
        self.assertEqual(self.run_commit(),'already_recorded')
        self.assertEqual(len(self.db.data),3)
        self.assertEqual(self.db.data['finance_transactions/gmail_'+EMAIL]['title'],'User edit')
    def test_other_email_same_event_does_not_create(self):
        self.run_commit()
        self.plan=plan_withdrawal(SENDER,TEXT,'abc123456789abce',ACCOUNTS,ALIASES)
        self.assertEqual(self.run_commit(),'hold_possible_duplicate_event')
        self.assertEqual(len(self.db.data),3)
    def test_legacy_processed_marker_fails_closed(self):
        self.db.data['processed_gmail_ids/'+EMAIL]={'processedAt':'old'}
        self.assertEqual(self.run_commit(),'hold_processed_legacy')
        self.assertEqual(len(self.db.data),1)
    def test_holds_do_not_write(self):
        self.plan={'action':'hold'}
        self.assertEqual(self.run_commit(),'hold')
        self.assertEqual(self.db.data,{})

if __name__ == '__main__': unittest.main()
