from utils import conectar_db

db = conectar_db()
docs = db.collection('finance_transactions').where('category', '==', 'Transporte').order_by('date', direction='DESCENDING').limit(12).get()

for d in docs:
    tx = d.to_dict()
    print(f"ID: {d.id} | Date: {tx.get('date')} | Title: {tx.get('title')} | Subcategory: {tx.get('subcategory')}")
