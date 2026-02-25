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

def mejorar_transaccion_con_historial(db, doc_id, transaccion, model_name="llama3"):
    """Mejora el título, subcategoría y contexto de una transacción usando historial y Ollama."""
    try:
        import ollama
    except ImportError:
        print("❌ Error: La librería 'ollama' no está instalada.")
        return

    import json

    category = transaccion.get('category', 'general')
    title = transaccion.get('title', 'Sin concepto')
    current_context = transaccion.get('context', 'personal')
    
    # 1. Traer subcategorías válidas desde settings
    doc_settings = db.collection('finance_settings').document('default').get()
    subcategories = []
    if doc_settings.exists:
        data = doc_settings.to_dict()
        for c in data.get('categories', []):
            if isinstance(c, dict) and c.get('name') == category:
                subcategories = c.get('subcategories', [])
                break
                
    if not subcategories:
        print(f"⚠️ No hay subcategorías definidas para la categoría '{category}'.")
    
    # 2. Rescatar historial (últimas 10 de esa categoría)
    historico_docs = db.collection('finance_transactions')\
        .where('category', '==', category)\
        .order_by('date', direction=firestore.Query.DESCENDING)\
        .limit(11)\
        .get()
        
    historial_str = ""
    count = 0
    for doc in historico_docs:
        if doc.id == doc_id:
            continue
        if count >= 10:
            break
        tx = doc.to_dict()
        h_title = tx.get('title', '')
        h_sub = tx.get('subcategory', '')
        h_ctx = tx.get('context', 'personal')
        historial_str += f"- Título: '{h_title}'"
        if h_sub:
            historial_str += f" | subcategoría: '{h_sub}'"
        historial_str += f" | contexto: '{h_ctx}'\n"
        count += 1
        
    if not historial_str:
        historial_str = "(No hay historial para esta categoría todavía)"
        
    prompt = f"""
Eres un asistente financiero experto.
Tu tarea es normalizar los datos de una transacción.
Aquí está el historial de las últimas 10 transacciones en la categoría '{category}':
{historial_str}

Las opciones de subcategoría válidas para esta categoría son: {subcategories}.
Las opciones de contexto válidas son: ['personal', 'business'].

Para la transacción actual:
- Título: '{title}'
- Contexto actual: '{current_context}'

Instrucciones:
1. Mejorar el título ('title'): debe ser lo más parecido posible a títulos del historial. No inventes nombres nuevos.
2. Elegir una subcategoría ('subcategory') de la lista proporcionada. Si no aplica ninguna o la lista está vacía, devuelve un string vacío "".
3. Determinar el contexto ('context'): 'personal' para gastos personales, 'business' para gastos de negocio/empresa. Usa el historial como referencia.

Devuelve ÚNICAMENTE un JSON válido sin texto adicional, sin markdown y sin explicaciones:
{{
  "subcategory": "",
  "title": "",
  "context": ""
}}
"""
    
    print(f"🧠 Mejorando transacción ({doc_id}) con IA local...")
    try:
        respuesta = ollama.chat(model=model_name, messages=[
            {'role': 'system', 'content': 'Solo respondes con formato JSON válido.'},
            {'role': 'user', 'content': prompt}
        ])
        
        contenido = respuesta['message']['content'].strip()
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        if contenido.endswith("```"):
            contenido = contenido[:contenido.rfind("```")]
            
        datos_mejorados = json.loads(contenido.strip())
        
        new_sub = datos_mejorados.get('subcategory', '')
        new_title = datos_mejorados.get('title', title)
        new_context = datos_mejorados.get('context', current_context)
        
        # Validar subcategoría inventada
        if new_sub and subcategories and new_sub not in subcategories:
            print(f"⚠️ La IA inventó la subcategoría '{new_sub}', la ignoramos.")
            new_sub = ""
            
        # Validar contexto
        if new_context not in ('personal', 'business'):
            print(f"⚠️ La IA devolvió contexto inválido '{new_context}', mantenemos '{current_context}'.")
            new_context = current_context
            
        updates = {}
        if new_sub:
            updates['subcategory'] = new_sub
        if new_title and new_title != title:
            updates['title'] = new_title
        if new_context and new_context != current_context:
            updates['context'] = new_context
            
        if updates:
            db.collection('finance_transactions').document(doc_id).update(updates)
            print(f"✅ Transacción {doc_id} mejorada: {updates}")
        else:
            print(f"⏭️ La IA no sugirió cambios para la transacción {doc_id}.")
            
    except Exception as e:
        print(f"❌ Error en mejora de transacción: {e}")
