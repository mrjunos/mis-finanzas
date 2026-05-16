"""Genera o refresca el token de OAuth de Gmail y lo sube a Firestore.

Ejecutar localmente. Si no hay un token válido en token.json, abre el
navegador para autenticarte con Gmail. Luego sube el token al documento
gmail_auth/token de Firestore, desde donde gmail_finanzas_sync.py lo lee y lo
refresca de forma autónoma en GitHub Actions.

Es seguro re-ejecutarlo: sirve tanto para la configuración inicial como para
recuperarse de un token revocado o expirado.

Uso:
    python bootstrap_token.py
"""
import os
import json

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

from utils import conectar_db

GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), 'credentials.json')
TOKEN_FILE = os.path.join(os.path.dirname(__file__), 'token.json')
TOKEN_COLLECTION = 'gmail_auth'
TOKEN_DOC = 'token'


def obtener_credenciales():
    """Devuelve credenciales válidas de Gmail.

    Reutiliza token.json si sigue sirviendo (válido o refrescable). Si no,
    abre el navegador para una nueva autenticación.
    """
    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, GMAIL_SCOPES)
        except Exception as e:
            print(f"⚠️ No se pudo leer token.json: {e}")

    if creds and creds.valid:
        print("✅ El token.json existente sigue siendo válido.")
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            print("🔄 Refrescando el token existente...")
            creds.refresh(Request())
            print("✅ Token refrescado.")
            return creds
        except Exception as e:
            print(f"⚠️ No se pudo refrescar el token existente: {e}")
            print("   Se abrirá el navegador para autenticar de nuevo.")

    # Autenticación interactiva
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"❌ No existe {CREDENTIALS_FILE}.")
        print("Descarga las credenciales OAuth (tipo 'Desktop App') desde Google Cloud Console.")
        raise SystemExit(1)

    print("🌐 Abriendo el navegador para autenticar con Gmail...")
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, GMAIL_SCOPES)
    # access_type=offline + prompt=consent garantizan que Google devuelva un refresh_token.
    creds = flow.run_local_server(port=0, access_type='offline', prompt='consent')
    return creds


def main():
    creds = obtener_credenciales()
    token_info = json.loads(creds.to_json())

    if not token_info.get('refresh_token'):
        print("❌ El token obtenido no contiene 'refresh_token'.")
        print("Revoca el acceso de la app en https://myaccount.google.com/permissions "
              "y vuelve a ejecutar este script.")
        raise SystemExit(1)

    # Guardar una copia local actualizada del token
    with open(TOKEN_FILE, 'w') as f:
        f.write(creds.to_json())

    db = conectar_db()
    db.collection(TOKEN_COLLECTION).document(TOKEN_DOC).set(token_info)
    print(f"✅ Token subido a Firestore ({TOKEN_COLLECTION}/{TOKEN_DOC}).")
    print("Ya puedes ejecutar el workflow 'Gmail Finance Sync' en GitHub Actions.")


if __name__ == '__main__':
    main()
