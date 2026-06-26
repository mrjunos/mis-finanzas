"""Prueba end-to-end de las notificaciones push.

Crea una transacción de prueba con status "pending" y envía el push EXACTO que
manda producción (data-only, con deep link ?editTx=<id>). Al tocar la
notificación, la app debe abrir el modal de edición de esa transacción.

Pensado para dispararse manualmente desde GitHub Actions (workflow
"Test Push Notification") usando el secret FIREBASE_ADMIN_SDK_JSON, o en local.

Uso:
    python send_test_push.py            # crea tx de prueba + envía push a todos los tokens
    python send_test_push.py --cleanup  # borra las tx de prueba creadas por este script

Requisito: al menos un dispositivo con notificaciones activadas (token en la
colección fcm_tokens). Solo depende de firebase-admin.
"""
import sys
import datetime
from firebase_admin import messaging
from utils import conectar_db

TEST_TITLE = "🧪 PRUEBA PUSH"


def enviar_push_pending(db, tx_id, tx):
    """Envía un push data-only a todos los tokens en fcm_tokens.

    Misma forma que `enviar_push_pending` en gmail_finanzas_sync.py; se duplica
    aquí para que el script no dependa de los módulos pesados de Gmail/Gemini.
    """
    tokens = [d.id for d in db.collection('fcm_tokens').stream()]
    if not tokens:
        print("⚠️ No hay tokens en fcm_tokens. Abre la app → Yo → Avisos → Activar.")
        return
    print(f"📱 Tokens registrados: {len(tokens)}")

    signo = '-' if tx.get('type') == 'debit' else '+'
    monto = f"{signo}{float(tx.get('amount', 0)):,.0f} {tx.get('currency', 'COP')}"
    body = f"{monto} · {tx.get('title', 'Movimiento')} · {tx.get('category', '')}"
    url = f"/?editTx={tx_id}"

    message = messaging.MulticastMessage(
        tokens=tokens,
        data={'txId': str(tx_id), 'url': url, 'title': '🧾 Pendiente de revisión', 'body': body},
        webpush=messaging.WebpushConfig(
            headers={'Urgency': 'high'},
            fcm_options=messaging.WebpushFCMOptions(link=url),
        ),
    )
    resp = messaging.send_each_for_multicast(message)
    print(f"🔔 Push enviado: {resp.success_count} ok, {resp.failure_count} fallidos.")
    for token, r in zip(tokens, resp.responses):
        if not r.success:
            print(f"   ❌ {token[:12]}… → {r.exception}")


def cleanup(db):
    n = 0
    for doc in db.collection('finance_transactions').where('title', '==', TEST_TITLE).stream():
        doc.reference.delete()
        n += 1
    print(f"🧹 Eliminadas {n} transacciones de prueba.")


def main():
    db = conectar_db()
    if '--cleanup' in sys.argv:
        cleanup(db)
        return

    tx = {
        "type": "debit",
        "amount": 50000,
        "currency": "COP",
        "title": TEST_TITLE,
        "category": "Mercado",
        "subcategory": "",
        "card": "general",
        "comments": "Transacción de prueba — bórrala cuando termines (--cleanup)",
        "context": "personal",
        "date": datetime.date.today().isoformat(),
        "status": "pending",
    }
    _, doc_ref = db.collection('finance_transactions').add(tx)
    print(f"✅ Tx de prueba creada (ID: {doc_ref.id})")
    enviar_push_pending(db, doc_ref.id, tx)
    print("\n👉 Revisa tu dispositivo. Al tocar la notificación debe abrirse el modal de edición.")
    print("   Para limpiar: vuelve a correr el workflow con cleanup=true (o `--cleanup` local).")


if __name__ == '__main__':
    main()
