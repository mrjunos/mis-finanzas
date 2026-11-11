"""Opt-in emulator tests. Cannot connect to production or use real credentials."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor

HOST = os.environ.get('FIRESTORE_EMULATOR_HOST')
PROJECT = os.environ.get('GCLOUD_PROJECT', '')
ENABLED = HOST == '127.0.0.1:8087' and PROJECT == 'demo-mis-finanzas-withdrawals'
if os.environ.get('RUN_FIRESTORE_EMULATOR_TESTS') == '1' and not ENABLED:
    raise RuntimeError('Refusing emulator tests: exact loopback host and demo project required')


@unittest.skipUnless(ENABLED, 'Opt-in Firestore emulator not configured')
class EmulatorTests(unittest.TestCase):
    def setUp(self):
        from google.cloud import firestore
        from google.auth.credentials import AnonymousCredentials
        from withdrawal_policy import plan_withdrawal
        from test_withdrawal_policy import EMAIL, TEXT, SENDER, ACCOUNTS, ALIASES
        self.fs = firestore
        self.db = firestore.Client(project=PROJECT, credentials=AnonymousCredentials())
        self.email = EMAIL
        for collection in ['finance_transactions', 'processed_gmail_ids',
                           'processed_gmail_ids/withdrawal_events/events',
                           'finance_import_review', 'finance_settings']:
            for doc in self.db.collection(collection).stream(): doc.reference.delete()
        self.plan = plan_withdrawal(SENDER, TEXT, EMAIL, ACCOUNTS, ALIASES)
        self.settings = {'accounts': ACCOUNTS, 'confirmedCardAliases': ALIASES}
        self.db.collection('finance_settings').document('default').set(self.settings)

    def commit(self, plan=None):
        from withdrawal_commit import commit_withdrawal
        return commit_withdrawal(self.db, plan or self.plan, self.fs.transactional, self.fs.SERVER_TIMESTAMP)

    def test_concurrent_same_email_creates_one(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.commit(), range(4)))
        self.assertEqual(results.count('created'), 1)
        self.assertEqual(len(list(self.db.collection('finance_transactions').stream())), 1)
        self.assertEqual(results.count('already_recorded'), 3)
        markers = list(self.db.collection('processed_gmail_ids').stream())
        events = list(self.db.collection('processed_gmail_ids/withdrawal_events/events').stream())
        self.assertEqual(len(markers), 1)
        self.assertEqual(len(events), 1)
        self.assertEqual(markers[0].to_dict()['transactionId'], self.plan['documentId'])
        self.assertEqual(events[0].to_dict()['transactionId'], self.plan['documentId'])

    def test_retry_after_label_failure_preserves_edit(self):
        self.assertEqual(self.commit(), 'created')
        ref = self.db.collection('finance_transactions').document(self.plan['documentId'])
        ref.update({'title': 'User correction'})
        self.assertEqual(self.commit(), 'already_recorded')
        self.assertEqual(ref.get().to_dict()['title'], 'User correction')

    def test_second_email_same_event_is_held(self):
        import copy
        self.commit()
        second = copy.deepcopy(self.plan)
        second['documentId'] += 'a'
        second['transaction']['source']['gmailMessageId'] += 'a'
        self.assertEqual(self.commit(second), 'hold_possible_duplicate_event')
        self.assertEqual(len(list(self.db.collection('finance_transactions').stream())), 1)

    def test_transaction_exception_is_atomic(self):
        @self.fs.transactional
        def interrupted(transaction):
            transaction.create(self.db.collection('finance_transactions').document('interrupted'), {'amount': 100000})
            raise RuntimeError('simulated interruption before commit')
        with self.assertRaises(RuntimeError): interrupted(self.db.transaction())
        self.assertFalse(self.db.collection('finance_transactions').document('interrupted').get().exists)

    def test_real_queries_and_dryrun_then_create(self):
        from withdrawal_pipeline import process_withdrawal
        from test_withdrawal_policy import TEXT, SENDER
        args = (self.db, SENDER, TEXT, self.email, self.fs.transactional, self.fs.SERVER_TIMESTAMP)
        self.assertEqual(process_withdrawal(*args, dry_run=True)['outcome'], 'dry_run')
        self.assertEqual(list(self.db.collection('finance_transactions').stream()), [])
        self.assertEqual(list(self.db.collection('processed_gmail_ids').stream()), [])
        self.assertEqual(list(self.db.collection('finance_import_review').stream()), [])
        self.assertEqual(process_withdrawal(*args)['outcome'], 'created')
        tx = self.db.collection('finance_transactions').document(self.plan['documentId']).get().to_dict()
        self.assertEqual((tx['type'], tx['card'], tx['destinationCard']), ('transfer', self.settings['accounts'][0], 'Efectivo'))

    def test_legacy_collision_and_missing_alias_preserve_no_new_transaction(self):
        from withdrawal_pipeline import process_withdrawal
        from test_withdrawal_policy import TEXT, SENDER
        args = (self.db, SENDER, TEXT, self.email, self.fs.transactional, self.fs.SERVER_TIMESTAMP)
        self.db.collection('finance_transactions').document('legacy').set({'type':'debit','amount':100000,'date':'2026-11-10'})
        self.assertFalse(process_withdrawal(*args)['removeLabel'])
        self.assertEqual(len(list(self.db.collection('finance_transactions').stream())),1)
        self.db.collection('finance_transactions').document('legacy').delete()
        self.db.collection('finance_settings').document('default').update({'confirmedCardAliases':{}})
        self.assertFalse(process_withdrawal(*args)['removeLabel'])
        self.assertEqual(list(self.db.collection('finance_transactions').stream()),[])

if __name__ == '__main__': unittest.main()
