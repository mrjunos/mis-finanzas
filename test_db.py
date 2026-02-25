from utils import conectar_db
db = conectar_db()
doc = db.collection('finance_settings').document('default').get()
if doc.exists:
    import json
    data = doc.to_dict()
    print(json.dumps(data.get('categories', []), indent=2))
