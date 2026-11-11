import ast
import argparse
import datetime
import io
import pathlib
import types
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
from withdrawal_pipeline import process_withdrawal
from test_withdrawal_policy import FakeDB, Ref, Collection, Snapshot, TEXT, EMAIL, SENDER, ACCOUNTS, ALIASES


class LocalRef(Ref):
    @property
    def id(self): return self.key.split('/')[-1]
    def get(self, transaction=None): return Snapshot(self.db.data.get(self.key))
    def set(self, data, merge=False): self.db.data[self.key]={**self.db.data.get(self.key,{}),**data}

class LocalCollection(Collection):
    def document(self, key): return LocalRef(self.db,self.name+'/'+key)
    def where(self, field, op, value): self.filter=(field,value); return self
    def get(self):
        result=[]
        for key,value in self.db.data.items():
            if key.startswith(self.name+'/') and value.get(self.filter[0])==self.filter[1]:
                item=Snapshot(value); item.id=key.split('/')[-1]; result.append(item)
        return result

class DB(FakeDB):
    def collection(self,name): return LocalCollection(self,name)


class BranchTests(unittest.TestCase):
    def setUp(self):
        self.db=DB()
        self.db.data['finance_settings/default']={'accounts':ACCOUNTS,'confirmedCardAliases':ALIASES}
    def run_branch(self,dry=False):
        return process_withdrawal(self.db,SENDER,TEXT,EMAIL,self.db.atomic,'now',dry_run=dry)
    def test_real_branch_creates_only_transfer_and_atomic_marker(self):
        r=self.run_branch()
        self.assertTrue(r['removeLabel'])
        self.assertEqual(self.db.data['finance_transactions/gmail_'+EMAIL]['type'],'transfer')
        self.assertEqual(self.db.data['processed_gmail_ids/'+EMAIL]['transactionId'],'gmail_'+EMAIL)
    def test_hold_preserves_original_email(self):
        self.db.data['finance_settings/default']['confirmedCardAliases']={}
        r=self.run_branch()
        self.assertFalse(r['removeLabel'])
        self.assertIn('finance_import_review/'+EMAIL,self.db.data)
        self.assertFalse(any(k.startswith('finance_transactions/') for k in self.db.data))
    def test_dry_run_never_persists(self):
        before=dict(self.db.data)
        self.assertEqual(self.run_branch(True)['outcome'],'dry_run')
        self.assertEqual(self.db.data,before)
    def test_legacy_same_amount_is_held(self):
        self.db.data['finance_transactions/old']={'type':'debit','date':'2026-11-10','amount':100000}
        self.assertFalse(self.run_branch()['removeLabel'])
        self.assertNotIn('finance_transactions/gmail_'+EMAIL,self.db.data)


class MainLoopTests(unittest.TestCase):
    def run_main(self, dry_run, body=TEXT, outcome=None):
        tree=ast.parse(pathlib.Path('gmail_finanzas_sync.py').read_text())
        node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
        calls=[]
        class Service:
            def users(self): return self
            def messages(self): return self
            def list(self,**kw): self.result={'messages':[{'id':EMAIL}]}; return self
            def get(self,**kw): self.result={'payload':{'headers':[{'name':'from','value':SENDER}]},'internalDate':1794315035000}; return self
            def execute(self): return self.result
        def model(*args,**kwargs): calls.append('model'); return {'type':'debit'},[]
        ns={'argparse':argparse,'os':types.SimpleNamespace(environ={'GEMINI_API_KEY':'fake'}),
            'genai':types.SimpleNamespace(Client=lambda **kw:None),'conectar_db':lambda:None,
            'authenticate_gmail':lambda db,**kw:Service(),'DEFAULT_LABEL':'Pending',
            'get_configured_label':lambda db:'Pending','get_label_id':lambda *a:'label',
            'is_processed':lambda *a:False,'looks_like_statement':lambda s:False,
            'datetime':datetime,'BOGOTA':datetime.timezone(datetime.timedelta(hours=-5)),
            'extract_email_body':lambda p:body,'is_third_party_uber_rides_alert':lambda *a:False,
            'firestore':types.SimpleNamespace(transactional=None,SERVER_TIMESTAMP=None),
            'process_withdrawal':lambda *a,**kw:outcome,
            'procesar_texto_con_ia':model,'MAX_BODY_CHARS':3500,
            'registrar_transaccion':lambda *a,**kw:calls.append(('writer',kw)) or True,
            'mark_as_processed':lambda *a:calls.append('label'),
            'save_processed_email':lambda *a:calls.append('marker')}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'main','exec'),ns)
        with patch('sys.argv',['sync']+(['--dry-run'] if dry_run else [])),redirect_stdout(io.StringIO()): ns['main']()
        return calls
    def test_held_withdrawal_never_calls_gemini_or_removes_label(self):
        self.assertEqual(self.run_main(False,outcome={'outcome':'hold','removeLabel':False}),[])
    def test_created_withdrawal_only_removes_label(self):
        self.assertEqual(self.run_main(False,outcome={'outcome':'created','removeLabel':True}),['label'])
    def test_main_dryrun_forwards_flag_and_never_marks(self):
        calls=self.run_main(True,body='ordinary purchase')
        self.assertEqual(calls[0],'model')
        self.assertTrue(calls[1][1]['dry_run'])
        self.assertEqual(calls[1][1]['email_id'],EMAIL)
        self.assertNotIn('label',calls)
        self.assertNotIn('marker',calls)


class WriterTests(unittest.TestCase):
    def test_actual_writer_is_atomic_and_idempotent(self):
        db=DB()
        node=next(n for n in ast.parse(pathlib.Path('gmail_finanzas_sync.py').read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='registrar_transaccion')
        ns={'PROCESSED_COLLECTION':'processed_gmail_ids',
            'firestore':types.SimpleNamespace(transactional=db.atomic,SERVER_TIMESTAMP='now'),
            'enviar_push_pending':lambda *a:None}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'writer','exec'),ns)
        data={'type':'debit','amount':9238,'title':'Uber','currency':'COP'}
        with redirect_stdout(io.StringIO()):
            self.assertTrue(ns['registrar_transaccion'](data,datetime.datetime(2026,11,10),db,[],email_id=EMAIL))
            self.assertTrue(ns['registrar_transaccion'](data,datetime.datetime(2026,11,10),db,[],email_id=EMAIL))
        self.assertEqual(len(db.data),2)
        self.assertEqual(db.data['processed_gmail_ids/'+EMAIL]['transactionId'],'gmail_'+EMAIL)

    def test_atomic_adapter_failure_leaves_no_partial_data(self):
        from withdrawal_policy import plan_withdrawal
        from withdrawal_commit import commit_withdrawal
        db=DB()
        original=db.create
        def fail_second(ref,data):
            if db.staged: raise RuntimeError('simulated commit interruption')
            return original(ref,data)
        db.create=fail_second
        plan=plan_withdrawal(SENDER,TEXT,EMAIL,ACCOUNTS,ALIASES)
        with self.assertRaises(RuntimeError): commit_withdrawal(db,plan,db.atomic,'now')
        self.assertEqual(db.data,{})

if __name__=='__main__': unittest.main()
