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
from utils import conectar_db

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
LOCK_FILE = os.path.join(os.path.dirname(__file__), 'gmail_sync.lock')

# Etiqueta por defecto a buscar
DEFAULT_LABEL = "Bancos/PendingBot" 

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

def load_processed_emails(db):
    """Carga los IDs de los correos ya procesados desde Firestore."""
    docs = db.collection('processed_gmail_ids').stream()
    return {doc.id for doc in docs}

def save_processed_email(db, email_id):
    """Guarda un ID de correo en Firestore como procesado."""
    db.collection('processed_gmail_ids').document(email_id).set({
        'processed_at': datetime.datetime.utcnow().isoformat()
    })

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

def procesar_texto_con_ia(texto, model_name="lfm2:24b"):
    """Procesar texto libre con IA local usando Ollama."""
    print("🧠 Contactando a Firebase para obtener contexto...")
    db = conectar_db()
    
    doc = db.collection('finance_settings').document('default').get()
    categorias, cuentas, monedas = [], [], []
    if doc.exists:
        data = doc.to_dict()
        categorias = data.get('categories', [])
        # Extract just category names (categories may be objects with {name, subcategories})
        categorias = [c['name'] if isinstance(c, dict) else c for c in categorias]
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
- comments: un mensaje breve descriptivo que resuma la transacción basada en el correo.

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
  "date": "",
  "comments": ""
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

def registrar_transaccion(datos_ia, fallback_date, model_name="lfm2:24b"):
    """Guardar la transacción extraída por la IA en Firestore."""
    from utils import mejorar_transaccion_con_historial
    db = conectar_db()
    
    # Manejar transacciones declinadas
    if datos_ia.get('type') == 'ignore':
        print("⏭️ La IA determinó que la transacción fue fallida o declinada. Ignorando guardado.")
        return True # Devolvemos True para que de todas formas le quite la etiqueta de Gmail

    # Usar la fecha extraída por la IA, o el fallback (fecha de recepción del correo)
    tx_date = fallback_date
    tx_date_str = datos_ia.get('date')

    if tx_date_str:
        try:
            if "T" in tx_date_str:
                tx_date_str = tx_date_str.split("T")[0]
            elif " " in tx_date_str:
                tx_date_str = tx_date_str.split(" ")[0]
                
            # Verificar que el formato sea correcto
            datetime.datetime.strptime(tx_date_str, "%Y-%m-%d")
            tx_date = tx_date_str
        except ValueError:
            pass # Si la IA devolvió algo raro, usamos el fallback_date

    # Sanitizar category: la IA puede devolver un objeto en vez de string
    raw_category = datos_ia.get('category', 'general')
    if isinstance(raw_category, dict):
        raw_category = raw_category.get('name', 'general')
    category = str(raw_category) if raw_category else 'general'

    # Rellenar valores por defecto para no romper el esquema
    nueva_transaccion = {
        "type": datos_ia.get('type', 'debit'),
        "amount": float(datos_ia.get('amount', 0)),
        "currency": datos_ia.get('currency', 'COP'),
        "title": datos_ia.get('title', 'Sin concepto especificado'),
        "category": category,
        "card": datos_ia.get('card', 'general'),
        "comments": datos_ia.get('comments', "Importado automáticamente desde Gmail via IA"),
        "context": datos_ia.get('context', 'personal'),
        "date": tx_date
    }

    print("\n📦 Datos a guardar en Firebase:")
    for k, v in nueva_transaccion.items():
        print(f"   {k}: {v}")
    
    try:
        _, doc_ref = db.collection('finance_transactions').add(nueva_transaccion)
        print(f"✅ Éxito: Registro guardado en Firebase (ID: {doc_ref.id})")
        
        # Mejorar título, subcategoría y contexto con IA
        mejorar_transaccion_con_historial(db, doc_ref.id, nueva_transaccion, model_name=model_name)
        
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
    parser.add_argument('--model', default='lfm2:24b', help="Modelo de LLM a usar (por defecto: lfm2:24b)")
    args = parser.parse_args()

    db = conectar_db()

    # --- Lock file: evitar ejecuciones simultáneas ---
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, 'r') as f:
                old_pid = int(f.read().strip())
            os.kill(old_pid, 0)  # Chequear si el proceso sigue vivo
            print(f"⏳ Ya hay un proceso de sync corriendo (PID: {old_pid}). Saliendo.")
            return
        except (ProcessLookupError, ValueError):
            print("⚠️ Lock huérfano encontrado (proceso anterior murió). Limpiando...")
            os.remove(LOCK_FILE)

    # Crear lock file con nuestro PID
    with open(LOCK_FILE, 'w') as f:
        f.write(str(os.getpid()))

    try:
        label_name = args.label

        print("🔑 Iniciando conexión con Gmail...")
        service = authenticate_gmail()
        
        print(f"🔍 Buscando el ID interno para la etiqueta '{label_name}'...")
        label_id = get_label_id(service, label_name)
        
        if not label_id:
            print(f"❌ No se encontró la etiqueta '{label_name}' en tu cuenta de Gmail.")
            print("Asegúrate de haberla creado en la interfaz de Gmail.")
            return

        print(f"✅ Etiqueta encontrada en servidor: {label_id}")
        
        processed_emails = load_processed_emails(db)
        
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
            
            # Extraer fecha de recepción del correo (solo fecha, sin hora)
            internal_date_ms = int(message_data.get('internalDate', 0))
            fallback_date = datetime.datetime.fromtimestamp(internal_date_ms / 1000.0).strftime("%Y-%m-%d") if internal_date_ms else datetime.datetime.now().strftime("%Y-%m-%d")
            
            body_text = extract_email_body(payload)
            
            if not body_text:
                print(f"⚠️ No se pudo extraer texto leíble del correo {msg_id}")
                # Lo marcamos procesado de todas formas para no ciclar eternamente en correos vacíos
                mark_as_processed(service, msg_id, label_id)
                save_processed_email(db, msg_id)
                continue
                
            # Para evitar enviar textos absurdamente gigantes a Ollama, limitamos el tamaño
            truncated_text = body_text[:3500] 
            print(f"📄 Texto detectado (resumen): {truncated_text[:100].replace(chr(10), ' ')}...")
            
            datos_ia = procesar_texto_con_ia(truncated_text, model_name=args.model)
            
            if datos_ia:
                success = registrar_transaccion(datos_ia, fallback_date, model_name=args.model)
                if success:
                    mark_as_processed(service, msg_id, label_id)
                    save_processed_email(db, msg_id)
            else:
                print(f"⚠️ El correo {msg_id} falló en la interpretación por IA. Se mantendrá la etiqueta para intentar luego.")
    finally:
        # SIEMPRE borrar el lock al salir (incluso si hay error)
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)

if __name__ == '__main__':
    main()
