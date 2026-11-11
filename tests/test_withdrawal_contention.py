"""Bounded retries only for transaction contention, never ambiguous failures."""
import unittest
from unittest.mock import Mock, patch
from google.api_core.exceptions import Aborted, PermissionDenied, DeadlineExceeded
from withdrawal_commit import commit_withdrawal

class ContentionTests(unittest.TestCase):
    def run_case(self, outcomes):
        db = Mock()
        db.transaction.side_effect = [object(), object(), object()]
        wrapped = Mock(side_effect=outcomes)
        plan = {'action': 'create_transfer', 'documentId': 'gmail-test',
                'transaction': {'source': {'gmailMessageId': 'test', 'eventKey': 'event'}}}
        with patch('withdrawal_commit.time.sleep') as sleep, patch('withdrawal_commit.random.uniform', return_value=0.5):
            try:
                result = commit_withdrawal(db, plan, lambda fn: wrapped, None)
            except Exception as error:
                result = error
        return result, wrapped, sleep

    def test_commit_exhaustion_rechecks_in_fresh_transaction(self):
        exhausted = ValueError('SDK retries exhausted')
        exhausted.__cause__ = Aborted('lock timeout')
        result, wrapped, sleep = self.run_case([exhausted, 'already_recorded'])
        self.assertEqual(result, 'already_recorded')
        self.assertNotEqual(wrapped.call_args_list[0].args, wrapped.call_args_list[1].args)
        sleep.assert_called_once_with(0.5)

    def test_read_abort_retries(self):
        result, wrapped, sleep = self.run_case([Aborted('read contention'), 'created'])
        self.assertEqual(result, 'created')
        self.assertEqual(wrapped.call_count, 2)

    def test_bounded_exhaustion_propagates(self):
        error = Aborted('contention')
        result, wrapped, sleep = self.run_case([error, error, error])
        self.assertIs(result, error)
        self.assertEqual(wrapped.call_count, 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [0.5, 1.0])

    def test_non_contention_errors_never_retried(self):
        for error in [ValueError('bad data'), PermissionDenied('denied'), DeadlineExceeded('unknown commit'), RuntimeError('bug')]:
            with self.subTest(error=type(error).__name__):
                result, wrapped, sleep = self.run_case([error])
                self.assertIs(result, error)
                self.assertEqual(wrapped.call_count, 1)
                sleep.assert_not_called()
