import os
import json
import base64
import argparse
import datetime
from bs4 import BeautifulSoup

# Google API
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Firebase
import firebase_admin
from firebase_admin import credentials as firebase_credentials, firestore

# Ollama
try:
    import ollama
except ImportError:
    print("❌ Error: La librería 'ollama' no está instalada. Ejecuta: pip install ollama")
    exit(1)

# --- CONFIGURACIÓN ---
# Permisos necesarios para leer labels y modificar (quitar) etiquetas
GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), 'credentials.json')
TOKEN_FILE = os.path.join(os.path.dirname(__file__), 'token.json')
PROCESSED_FILE = os.path.join(os.path.dirname(__file__), 'processed_emails.txt')

# IMPORTANTE: Cambia esta ruta si tu archivo de llaves de Firebase tiene otro nombre
# Busca en variable de entorno o usa el archivo por defecto
default_creds = os.path.join(os.path.dirname(__file__), 'firebase-adminsdk-fbsvc-bb7cb78f3e.json')
FIREBASE_CREDENTIALS = os.getenv('FIREBASE_CREDENTIALS', default_creds)

# Etiqueta por defecto a buscar
DEFAULT_LABEL = "Bancos/PendingBot" 

def conectar_db():
    if not firebase_admin._apps:
        cred = firebase_credentials.Certificate(FIREBASE_CREDENTIALS)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def authenticate_gmail():
    """Autentica con la API de Gmail y devuelve el servicio."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, GMAIL_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"\n❌ FALTAN CREDENCIALES OAUTH 2.0")
                print(f"El archivo {CREDENTIALS_FILE} no existe.")
                print("1. Ve a Google Cloud Console")
                print("2. Habilita la Gmail API")
                print("3. Crea credenciales tipo 'Desktop App' (OAuth 2.0 Client IDs)")
                print("4. Descarga el JSON y nómbralo credentials.json en esta misma carpeta.\n")
                exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, GMAIL_SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

def load_processed_emails():
    """Carga los IDs de los correos ya procesados."""
    if not os.path.exists(PROCESSED_FILE):
        return set()
    with open(PROCESSED_FILE, 'r') as f:
        return set(line.strip() for line in f if line.strip())

def save_processed_email(email_id):
    """Guarda un ID de correo en la lista de procesados."""
    with open(PROCESSED_FILE, 'a') as f:
        f.write(f"{email_id}\n")

def get_label_id(service, label_name):
    """Busca el ID interno de Gmail correspondiente al nombre de una etiqueta."""
    results = service.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])
    for label in labels:
        if label['name'].lower() == label_name.lower():
            return label['id']
    return None

def extract_email_body(payload):
    """Extrae el texto del cuerpo del correo, limpiando HTML."""
    text_content = ""
    
    # Función recursiva para buscar la parte de texto
    def get_text_from_parts(parts):
        nonlocal text_content
        for part in parts:
            mime_type = part.get("mimeType")
            body = part.get("body", {})
            data = body.get("data")
            
            if mime_type == "text/plain" and data:
                text_content += base64.urlsafe_b64decode(data).decode("utf-8")
            elif mime_type == "text/html" and data:
                html = base64.urlsafe_b64decode(data).decode("utf-8")
                soup = BeautifulSoup(html, "html.parser")
                text_content += soup.get_text(separator="\n")
            elif "parts" in part:
                get_text_from_parts(part["parts"])
                
    if "parts" in payload:
        get_text_from_parts(payload["parts"])
    else:
        # El correo podría no ser multipart
        body = payload.get("body", {})
        data = body.get("data")
        mime_type = payload.get("mimeType", "")
        if data:
            decoded = base64.urlsafe_b64decode(data).decode("utf-8")
            if "html" in mime_type:
                soup = BeautifulSoup(decoded, "html.parser")
                text_content = soup.get_text(separator="\n")
            else:
                text_content = decoded
                
    return text_content.strip()

def procesar_texto_con_ia(texto, model_name="llama3"):
    """Procesar texto libre con IA local usando Ollama."""
    print("🧠 Contactando a Firebase para obtener contexto...")
    db = conectar_db()
    
    doc = db.collection('finance_settings').document('default').get()
    categorias, cuentas, monedas = [], [], []
    if doc.exists:
        data = doc.to_dict()
        categorias = data.get('categories', [])
        cuentas = data.get('accounts', [])
        monedas = data.get('currencies', [])
        
    prompt = f"""
Eres un experto asistente financiero automatizado de lectura de recibos y correos.
Extrae los datos de esta transacción descrita en el correo electrónico y devuelve ÚNICAMENTE un objeto JSON válido.
Ignora firmas, saludos, o información legal/publicidad. Céntrate en la transacción (quién cobró y cuánto).
Si es una notificación de correo donde TÚ pagaste, es type: debit.
¡MUY IMPORTANTE!: Si el correo indica explícitamente que la transacción "no fue exitosa", fue "Rechazada", "Fallida", "No exitosa", "Declinada", etc., devuelve el type como "ignore".

Reglas para los campos:
- type: 'debit' (gasto), 'credit' (ingreso), o 'ignore' (si la transacción falló o fue declinada).
- amount: el monto numérico exacto (sin símbolos de moneda, asegúrate de que sea positivo).
- title: un resumen muy corto del concepto/comercio.
- currency: elige la opción correcta de {monedas} o usa 'COP' si el texto dice $, pesos, etc.
- category: elige la opción correcta de {categorias} según la data del correo. Si no aplica ninguna, usa 'Otros'.
- card: elige la opción correcta de {cuentas} según la data del correo.
- context: usa 'personal' por defecto.
- date: extrae la fecha EN LA QUE OCURRIÓ LA TRANSACCIÓN directamente desde el cuerpo del texto. Debe estar estrictamente en formato "YYYY-MM-DD".

Texto del correo:
"{texto}"

Solo debes imprimir el código JSON directo, sin explicación ni markdown. Formato esperado:
{{
  "type": "",
  "amount": 0,
  "title": "",
  "currency": "",
  "category": "",
  "card": "",
  "context": "",
  "date": ""
}}

Si la transacción no fue exitosa:
{{
  "type": "ignore"
}}
"""
    print(f"🧠 Analizando correo con IA local ({model_name})...")
    try:
        respuesta = ollama.chat(model=model_name, messages=[
            {'role': 'system', 'content': 'Solo respondes con formato JSON válido.'},
            {'role': 'user', 'content': prompt}
        ])
        
        contenido = respuesta['message']['content'].strip()
        
        # Limpieza básica
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        if contenido.endswith("```"):
            contenido = contenido[:contenido.rfind("```")]
        
        datos_extraidos = json.loads(contenido.strip())
        print("✅ Análisis JSON completado con éxito.")
        return datos_extraidos
    except Exception as e:
        print(f"\n❌ Error analizando o interpretando respuesta de IA: {e}")
        return None

def registrar_transaccion(datos_ia, fallback_date):
    """Guardar la transacción extraída por la IA en Firestore."""
    db = conectar_db()
    
    # Manejar transacciones declinadas
    if datos_ia.get('type') == 'ignore':
        print("⏭️ La IA determinó que la transacción fue fallida o declinada. Ignorando guardado.")
        return True # Devolvemos True para que de todas formas le quite la etiqueta de Gmail

    # Manejar la fecha extraída por la IA, o usar la del correo
    tx_date_str = datos_ia.get('date')
    tx_date = fallback_date
    if tx_date_str:
        try:
            # Quitamos cualquier hora que la IA haya puesto por error y forzamos el mediodía
            if "T" in tx_date_str:
                tx_date_str = tx_date_str.split("T")[0]
            elif " " in tx_date_str:
                tx_date_str = tx_date_str.split(" ")[0]
                
            # Forzamos 12:00 PM para evitar problemas de timezone UTC -> Latam en Firebase
            tx_date = datetime.datetime.strptime(tx_date_str, "%Y-%m-%d").replace(hour=12)
        except ValueError:
            pass # Si la IA devolvió algo raro, usamos el fallback_date
            
    # Rellenar valores por defecto para no romper el esquema
    nueva_transaccion = {
        "type": datos_ia.get('type', 'debit'),
        "amount": float(datos_ia.get('amount', 0)),
        "currency": datos_ia.get('currency', 'COP'),
        "title": datos_ia.get('title', 'Sin concepto especificado'),
        "category": datos_ia.get('category', 'general'),
        "card": datos_ia.get('card', 'general'),
        "comments": "Importado automáticamente desde Gmail via IA",
        "context": datos_ia.get('context', 'personal'),
        "date": tx_date
    }

    print("\n📦 Datos a guardar en Firebase:")
    for k, v in nueva_transaccion.items():
        if k == "date":
            # Si es un objeto de datetime, imprimimos un string más limpio
            if hasattr(v, 'strftime'):
                print(f"   {k}: {v.strftime('%Y-%m-%d %H:%M:%S')}")
            else:
                print(f"   {k}: {v} (Firebase Server Timestamp)")
        else:
            print(f"   {k}: {v}")
    
    try:
        _, doc_ref = db.collection('finance_transactions').add(nueva_transaccion)
        print(f"✅ Éxito: Registro guardado en Firebase (ID: {doc_ref.id})")
        return True
    except Exception as e:
        print(f"❌ Error al guardar en Firebase: {e}")
        return False

def mark_as_processed(service, msg_id, label_id_to_remove):
    """Remueve la etiqueta del correo en Gmail."""
    try:
        service.users().messages().modify(
            userId='me', 
            id=msg_id, 
            body={'removeLabelIds': [label_id_to_remove]}
        ).execute()
        print(f"✅ Etiqueta removida del correo {msg_id}")
    except Exception as e:
        print(f"⚠️ Error intentando remover etiqueta: {e}")

def main():
    parser = argparse.ArgumentParser(description="Automatización de Gmail a Firebase con LLM Local")
    parser.add_argument('--label', default=DEFAULT_LABEL, help=f"Nombre de la etiqueta en Gmail (por defecto: '{DEFAULT_LABEL}')")
    parser.add_argument('--model', default='llama3', help="Modelo de LLM a usar (por defecto: llama3)")
    args = parser.parse_args()

    label_name = args.label
    
    # Verificando si existe la estructura basica
    if not os.path.exists(PROCESSED_FILE):
        open(PROCESSED_FILE, 'w').close()

    print("🔑 Iniciando conexión con Gmail...")
    service = authenticate_gmail()
    
    print(f"🔍 Buscando el ID interno para la etiqueta '{label_name}'...")
    label_id = get_label_id(service, label_name)
    
    if not label_id:
        print(f"❌ No se encontró la etiqueta '{label_name}' en tu cuenta de Gmail.")
        print("Asegúrate de haberla creado en la interfaz de Gmail.")
        return

    print(f"✅ Etiqueta encontrada en servidor: {label_id}")
    
    processed_emails = load_processed_emails()
    
    print(f"📫 Buscando correos con la etiqueta '{label_name}'...")
    # Búsqueda por query
    query = f"label:{label_name}"
    results = service.users().messages().list(userId='me', q=query).execute()
    messages = results.get('messages', [])

    if not messages:
        print("✅ No se encontraron correos pendientes para procesar.")
        return
        
    for msg in messages:
        msg_id = msg['id']
        
        if msg_id in processed_emails:
            print(f"⏭️ El correo {msg_id} ya fue procesado pero sigue etiquetado. Intentando remover etiqueta y saltando...")
            mark_as_processed(service, msg_id, label_id)
            continue
            
        print(f"\n" + "-"*50)
        print(f"📩 Procesando nuevo correo: {msg_id}")
        
        # Descargar el correo completo
        message_data = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
        payload = message_data.get('payload', {})
        
        # Extraer fecha exacta de recepción en Gmail (milliseconds epoch)
        internal_date_ms = int(message_data.get('internalDate', 0))
        fallback_date = datetime.datetime.fromtimestamp(internal_date_ms / 1000.0) if internal_date_ms else firestore.SERVER_TIMESTAMP
        
        body_text = extract_email_body(payload)
        
        if not body_text:
            print(f"⚠️ No se pudo extraer texto leíble del correo {msg_id}")
            # Lo marcamos procesado de todas formas para no ciclar eternamente en correos vacíos
            mark_as_processed(service, msg_id, label_id)
            save_processed_email(msg_id)
            continue
            
        # Para evitar enviar textos absurdamente gigantes a Ollama, limitamos el tamaño
        truncated_text = body_text[:3500] 
        print(f"📄 Texto detectado (resumen): {truncated_text[:100].replace(chr(10), ' ')}...")
        
        datos_ia = procesar_texto_con_ia(truncated_text, model_name=args.model)
        
        if datos_ia:
            success = registrar_transaccion(datos_ia, fallback_date)
            if success:
                mark_as_processed(service, msg_id, label_id)
                save_processed_email(msg_id)
        else:
            print(f"⚠️ El correo {msg_id} falló en la interpretación por IA. Se mantendrá la etiqueta para intentar luego.")

if __name__ == '__main__':
    main()
