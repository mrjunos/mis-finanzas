import os
import firebase_admin
from firebase_admin import credentials, firestore

# Archivo de llave secreta de Firebase
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), 'firebase-adminsdk-fbsvc-bb7cb78f3e.json')

def conectar_db():
    """Conecta a la base de datos Firestore."""
    if not firebase_admin._apps:
        cred = credentials.Certificate(CREDENTIALS_FILE)
        firebase_admin.initialize_app(cred)
    return firestore.client()
