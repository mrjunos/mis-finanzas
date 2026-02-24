import firebase_admin
from firebase_admin import credentials, firestore
import os

# Busca en variable de entorno o usa el archivo por defecto
default_creds = os.path.join(os.path.dirname(__file__), 'firebase-adminsdk-fbsvc-bb7cb78f3e.json')
FIREBASE_CREDENTIALS = os.getenv('FIREBASE_CREDENTIALS', default_creds)

def clean_db():
    print("Conectando a Firebase...")
    cred = credentials.Certificate(FIREBASE_CREDENTIALS)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("Borrando todas las transacciones...")
    docs = db.collection('finance_transactions').stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1
    print(f"✅ Se borraron {deleted} transacciones de prueba.")

if __name__ == '__main__':
    clean_db()
