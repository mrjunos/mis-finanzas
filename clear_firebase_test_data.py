from utils import conectar_db

def clean_db():
    print("Conectando a Firebase...")
    db = conectar_db()

    print("Borrando todas las transacciones...")
    docs = db.collection('finance_transactions').stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1
    print(f"✅ Se borraron {deleted} transacciones de prueba.")

if __name__ == '__main__':
    clean_db()
