import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('firebase-adminsdk-fbsvc-bb7cb78f3e.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

updates = {
    '0SAEWB9czXbw1ZjbHdNo': ('Estilo de Vida y Ocio', 'Suscripciones'),
    '4LAPkNteTEzDExJwUhFW': ('Comida', 'Restaurantes / Cafés'),
    '6pME5W8ZR8riKWxLVeiK': ('Hogar', 'Mercado'),
    'HfG4f0BmH390HFE5llG5': ('Estilo de Vida y Ocio', 'Suscripciones'),
    'HgUPO7JhKXOTDi8Wqp1S': ('Comida', 'Domicilios / Rappi'),
    'WjUmwvcsyOtCfGA0ikzj': ('Comida', 'Domicilios / Rappi'),
    'jClMyZjUaMzPOceql4Re': ('Salud y Bienestar', 'Medicamentos / Farmacia'),
    'ngmDPvtqtdW2PLIZ3ZaE': ('Comida', 'Restaurantes / Cafés'),
    'osIz93rrrtiLQ33eedzR': ('Estilo de Vida y Ocio', 'Compras / Ropa / Gadgets'),
    'wgRVHJrv49cXge0Rm9sf': ('Salud y Bienestar', 'Medicamentos / Farmacia')
}

for doc_id, (cat, sub) in updates.items():
    db.collection('finance_transactions').document(doc_id).update({
        'category': cat,
        'subcategory': sub
    })
    print(f'Updated {doc_id} -> {cat} / {sub}')

settings_ref = db.collection('finance_settings').document('default')
settings = settings_ref.get().to_dict()
if 'categories' in settings:
    categories = settings['categories']
    new_categories = [c for c in categories if c.get('name') not in ['Compras', 'Ahorro Love 💕']]
    settings_ref.update({'categories': new_categories})
    print('Updated settings to remove Compras and Ahorro Love 💕')
else:
    print('No categories found config')

