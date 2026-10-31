import ast
import pathlib
import unittest
from card_resolution import resolve_card, suffixes
from tx_enrich import validate_classification, apply_merchant_memory, build_merchant_memory

ACCOUNTS = ['Rappi Visa *3323', 'Rappi Visa *3716', 'Bancolombia Master *7761']

class ResolutionTests(unittest.TestCase):
    def resolve(self, text, accounts=ACCOUNTS, card='Rappi Visa *3323'):
        return resolve_card({'card':card, 'type':'debit', 'comments':'Detalle'}, text, accounts)

    def test_unique_suffix_overrides_wrong_catalog_choice(self):
        out=self.resolve('Compra en RAPPI tarjeta *3716 por $30.250')
        self.assertEqual(out['card'], ACCOUNTS[1])
        self.assertEqual(out['cardResolution']['status'],'resolved')

    def test_suffix_formats(self):
        for text in ['*3716','****3716','XXXX3716','•••• 3716','tarjeta terminada en 3716',
                     'Tarjeta: 3716','tarjeta de crédito terminada en 3716','card ending in 3716',
                     'Cuenta 3716','tarjeta\n*3716']:
            with self.subTest(text=text): self.assertEqual(suffixes(text), {'3716'})

    def test_no_arbitrary_numbers(self):
        for text in ['30.250 COP 29/10/2026 autorización 381415','Compra por 3716 pesos',
                     'tarjeta 3716123456','****3716123456','2026-10-29', 'Tarjeta 1234 5678 9012 3716', 'Autorización X3716', 'Tarjeta 1234\n5678\n9012\n3716', 'Tarjeta *1234 5678 9012 3716']:
            with self.subTest(text=text): self.assertEqual(suffixes(text),set())

    def test_unknown_suffix_not_fuzzy(self):
        out=self.resolve('Compra tarjeta *3716',ACCOUNTS[:1])
        self.assertEqual(out['card'],'')
        self.assertEqual(out['cardResolution']['reason'],'unknown_suffix')
        self.assertIn('Cuenta por confirmar',out['comments'])

    def test_ambiguous_catalog(self):
        out=self.resolve('Compra tarjeta *3716',['Visa *3716','Master *3716'])
        self.assertEqual(out['card'],'')
        self.assertEqual(out['cardResolution']['reason'],'ambiguous_catalog_suffix')

    def test_multiple_identifiers(self):
        out=self.resolve('Desde cuenta *3323 hacia tarjeta *3716')
        self.assertEqual(out['card'],'')
        self.assertEqual(out['cardResolution']['reason'],'multiple_identifiers')

    def test_transfer_never_assigns_destination_as_source(self):
        out = self.resolve('Transferencia a la cuenta *3716')
        self.assertEqual(out['card'], '')
        self.assertEqual(out['cardResolution']['reason'], 'transfer_source_unconfirmed')

    def test_duplicate_same_identifier(self):
        out=self.resolve('Tarjeta *3716. Tu tarjeta *3716')
        self.assertEqual(out['card'],ACCOUNTS[1])

    def test_payment_never_assigns_destination_as_source(self):
        for text in ['Recibimos el pago de tu tarjeta *3716 por PSE',
                     'Pago a tarjeta *3716 desde cuenta *7761',
                     'Pago de tarjeta de crédito RappiCard *3716',
                     'Credit card payment *3716','Pagaste tu tarjeta *3716',
                     'Abono a tu RappiCard *3716 por PSE',
                     'Pago recibido en RappiCard *3716', 'Pago de tu RappiCard *3716',
                     'Tu pago fue recibido. RappiCard *3716',
                     'El pago de $100 a tu RappiCard *3716 fue realizado',
                     'Payment received for card *3716']:
            with self.subTest(text=text):
                out=self.resolve(text)
                self.assertEqual(out['card'],'')
                self.assertEqual(out['cardResolution']['reason'],'card_payment_source_unconfirmed')

    def test_purchase_is_not_repayment(self):
        self.assertEqual(self.resolve('Pago con tarjeta *3716 en RAPPI')['card'],ACCOUNTS[1])

    def test_missing_identifier_does_not_guess(self):
        self.assertEqual(self.resolve('Compra en RAPPI')['card'],'')

    def test_ignore_unchanged(self):
        data={'type':'ignore'}
        self.assertEqual(resolve_card(data,'*3716',ACCOUNTS),data)

    def test_no_mutation(self):
        data={'type':'debit','card':'wrong'}
        resolve_card(data,'*3716',ACCOUNTS)
        self.assertEqual(data,{'type':'debit','card':'wrong'})

    def test_leading_zero_suffix(self):
        self.assertEqual(self.resolve('tarjeta *0012',['Visa *0012'])['card'],'Visa *0012')

    def test_catalog_trailing_suffix_without_mask(self):
        self.assertEqual(self.resolve('*3716',['Rappi Visa 3716'])['card'],'Rappi Visa 3716')

    def test_fuzzy_cannot_change_last_four(self):
        out=validate_classification({'card':'Rappi Visa *3716'},[],['Rappi Visa *3323'])
        self.assertEqual(out['card'],'Rappi Visa *3716')

    def test_fuzzy_same_suffix_still_works(self):
        out=validate_classification({'card':'Rappi Vsa *3716'},[],ACCOUNTS)
        self.assertEqual(out['card'],ACCOUNTS[1])

    def test_full_text_after_llm_truncation(self):
        out=self.resolve('x '*4000+' tarjeta *3716')
        self.assertEqual(out['card'],ACCOUNTS[1])

    def test_integration_writer_keeps_pending_and_metadata(self):
        # Execute only the pure writer function with mocks; never import SDKs.
        source=pathlib.Path('gmail_finanzas_sync.py').read_text()
        tree=ast.parse(source)
        node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='registrar_transaccion')
        namespace={}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'writer','exec'),namespace)
        class DB:
            def collection(self,*a): raise AssertionError('Unexpected external write')
        import datetime
        from contextlib import redirect_stdout
        import io
        out=self.resolve('Recibimos el pago de tu tarjeta *3716')
        out['amount']=100
        capture=io.StringIO()
        with redirect_stdout(capture):
            self.assertTrue(namespace['registrar_transaccion'](out,datetime.datetime(2026,10,29),DB(),[],dry_run=True))
        self.assertIn('status: pending',capture.getvalue())
        self.assertIn('cardResolution:',capture.getvalue())
        self.assertIn('needs_review',capture.getvalue())


class PipelineTests(unittest.TestCase):
    def test_mocked_gemini_pipeline_corrects_and_preserves_fields(self):
        import json
        import types
        from contextlib import redirect_stdout
        import io
        source=pathlib.Path('gmail_finanzas_sync.py').read_text()
        tree=ast.parse(source)
        node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='procesar_texto_con_ia')
        from card_resolution import resolve_card
        namespace={
            'json':json, 'GEMINI_MODEL':'fake',
            '_prefetch_context':lambda db: ([{'name':'Comida','subcategories':[]}],ACCOUNTS,['COP'],[],{}),
            'memory_for_prompt':lambda m: [], 'apply_merchant_memory':apply_merchant_memory,
            'validate_classification':validate_classification, 'resolve_card':resolve_card,
            'types':types.SimpleNamespace(GenerateContentConfig=lambda **kw:kw),
        }
        exec(compile(ast.Module(body=[node],type_ignores=[]),'pipeline','exec'),namespace)
        extracted={'type':'debit','card':ACCOUNTS[0],'amount':30250,'title':'RAPPI','category':'Comida','comments':'detalle'}
        client=types.SimpleNamespace(models=types.SimpleNamespace(generate_content=lambda **kw:types.SimpleNamespace(text=json.dumps(extracted))))
        with redirect_stdout(io.StringIO()):
            out,_=namespace['procesar_texto_con_ia']('truncated',None,client,source_text='x '*4000+' tarjeta *3716')
        self.assertEqual(out['card'],ACCOUNTS[1])
        for key in ['amount','title','category','comments']: self.assertEqual(out[key],extracted[key])

    def test_both_call_sites_pass_full_body(self):
        tree=ast.parse(pathlib.Path('gmail_finanzas_sync.py').read_text())
        calls=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='procesar_texto_con_ia']
        self.assertEqual(len(calls),2)
        for call in calls:
            self.assertTrue(any(k.arg=='source_text' and isinstance(k.value,ast.Name) and k.value.id=='body_text' for k in call.keywords))

if __name__=='__main__': unittest.main()
