from datetime import datetime
import sys
import argparse
import os
import json
from firebase_admin import firestore
from utils import conectar_db

def mostrar_opciones():
    """PASO 1: Leer y mostrar las opciones de configuración de la app."""
    db = conectar_db()
    doc = db.collection('finance_settings').document('default').get()
    
    if doc.exists:
        data = doc.to_dict()
        print("\n--- CONFIGURACIÓN ACTUAL ---")
        print(f"CATEGORÍAS: {data.get('categories', [])}")
        print(f"CUENTAS:    {data.get('accounts', [])}")
        print(f"MONEDAS:    {data.get('currencies', [])}")
        print("----------------------------\n")
    else:
        print("Error: No se encontró el documento de configuración.")

def procesar_texto_con_ia(texto):
    """PASO Opcional: Procesar texto libre con IA local usando Ollama."""
    try:
        import ollama
    except ImportError:
        print("❌ Error: La librería 'ollama' no está instalada. Ejecuta: pip install ollama")
        return None

    db = conectar_db()
    
    # Obtener configuración para darle contexto a la IA
    doc = db.collection('finance_settings').document('default').get()
    categorias, cuentas, monedas = [], [], []
    if doc.exists:
        data = doc.to_dict()
        categorias = data.get('categories', [])
        cuentas = data.get('accounts', [])
        monedas = data.get('currencies', [])
    else:
        print("⚠️ Advertencia: No se encontró la configuración en Firebase. La IA intentará adivinar por su cuenta.")
        
    prompt = f"""
Eres un experto asistente financiero. Extrae los datos de esta transacción descrita en texto libre y devuelve ÚNICAMENTE un objeto JSON válido.

Reglas para los campos:
- type: 'debit' (gasto) o 'credit' (ingreso).
- amount: el monto numérico (sin símbolos).
- title: un resumen muy corto del concepto.
- currency: elige de {monedas} o usa 'COP' por defecto.
- category: elige la opción más exacta de {categorias}. Si no aplica ninguna, usa 'general'.
- card: elige la opción de cuenta o tarjeta de {cuentas}. Si no hay, inventa una general.
- context: usa 'personal' por defecto, o 'business' si aplica.

Texto del usuario: "{texto}"

Solo debes imprimir el código JSON directo, sin explicación ni markdown. Formato esperado:
{{
  "type": "debit",
  "amount": 100,
  "title": "Concepto",
  "currency": "COP",
  "category": "comida",
  "card": "bancolombia",
  "context": "personal"
}}
"""
    print("\n🧠 Analizando texto con IA local (Ollama)...")
    try:
        # NOTA: Cambia 'llama3' a 'phi3' según el modelo que descargues
        respuesta = ollama.chat(model='llama3', messages=[
            {'role': 'system', 'content': 'Solo respondes con formato JSON válido.'},
            {'role': 'user', 'content': prompt}
        ])
        
        contenido = respuesta['message']['content'].strip()
        
        # Limpieza básica en caso de que la IA agregue backticks
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        if contenido.endswith("```"):
            contenido = contenido[:contenido.rfind("```")]
        
        datos_extraidos = json.loads(contenido.strip())
        print("✅ Análisis completado con éxito.")
        return datos_extraidos
    except json.JSONDecodeError:
        print("\n❌ Error: La IA no devolvió un JSON válido. Respuesta cruda:")
        print(contenido)
        return None
    except Exception as e:
        print(f"\n❌ Error al comunicarse con Ollama: {e}")
        print("¿Tienes Ollama abierto y descargaste el modelo ejecutando 'ollama run llama3' o 'ollama run phi3' en la terminal?")
        return None

def registrar_transaccion(args):
    """PASO 2: Guardar la transacción enviada por comandos."""
    db = conectar_db()
    
    # Manejo de la fecha
    if getattr(args, 'date', None):
        try:
            # Intenta parsear formato YYYY-MM-DD o DD/MM/YYYY
            input_date = args.date
            if '/' in input_date:
                tx_datetime = datetime.strptime(input_date, "%d/%m/%Y")
            else:
                tx_datetime = datetime.strptime(input_date, "%Y-%m-%d")
            # Configurar como UTC para Firebase
            tx_date = tx_datetime
        except Exception as e:
            print(f"⚠️ Error parseando fecha '{args.date}', usando hoy. (Formatos: YYYY-MM-DD o DD/MM/YYYY)")
            tx_date = firestore.SERVER_TIMESTAMP
    else:
        tx_date = firestore.SERVER_TIMESTAMP

    nueva_transaccion = {
        "type": getattr(args, 'type', 'debit'),
        "amount": float(getattr(args, 'amount', 0)),
        "currency": getattr(args, 'currency', 'USD'),
        "title": getattr(args, 'title', 'Sin concepto'),
        "category": getattr(args, 'category', 'general'),
        "card": getattr(args, 'card', 'Sin especificar'),
        "comments": getattr(args, 'comments', ''),
        "context": getattr(args, 'context', 'personal'),
        "date": tx_date
    }

    print("\n📦 Datos a enviar:")
    for k, v in nueva_transaccion.items():
        print(f"   {k}: {v}")
    
    try:
        _, doc_ref = db.collection('finance_transactions').add(nueva_transaccion)
        print(f"\n✅ Éxito: Registro guardado (ID: {doc_ref.id})")
    except Exception as e:
        print(f"\n❌ Error al guardar en Firebase: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Puente de Firebase para el Bot de Finanzas")
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")

    # COMANDO 1: Ver opciones (Búsqueda)
    # Uso: python3 bot_finanzas_ejemplo.py options
    subparsers.add_parser('options', help="Consultar categorías y cuentas disponibles")

    # COMANDO 2: Registrar transacción
    # Uso: python3 bot_finanzas_ejemplo.py add --type X --amount Y ...
    add_parser = subparsers.add_parser('add', help="Registrar una nueva transacción")
    add_parser.add_argument('--type', choices=['debit', 'credit'], required=True, help="Tipo de movimiento")
    add_parser.add_argument('--amount', type=float, required=True, help="Monto numérico")
    add_parser.add_argument('--title', required=True, help="Concepto (Concepto)")
    add_parser.add_argument('--currency', required=True, help="Moneda (ej: COP)")
    add_parser.add_argument('--category', required=True, help="Categoría existente")
    add_parser.add_argument('--card', required=True, help="Cuenta o Tarjeta de origen")
    add_parser.add_argument('--context', choices=['personal', 'business'], required=True, help="Contexto")
    
    # Campos opcionales
    add_parser.add_argument('--date', help="Fecha (AAAA-MM-DD o DD/MM/AAAA). Si se omite, usa HOY.")
    add_parser.add_argument('--comments', default="", help="Comentarios adicionales")

    # COMANDO 3: Transacción con IA (Texto libre)
    # Uso: python3 bot_finanzas_ejemplo.py ai "Gasté 500 pesos en el súper con tc_credito"
    ai_parser = subparsers.add_parser('ai', help="Añadir transacción analizando texto libre con IA")
    ai_parser.add_argument('text', nargs='+', help="El texto descriptivo del movimiento")

    args = parser.parse_args()

    if args.command == 'options':
        mostrar_opciones()
    elif args.command == 'add':
        registrar_transaccion(args)
    elif args.command == 'ai':
        texto_completo = " ".join(args.text)
        datos_ia = procesar_texto_con_ia(texto_completo)
        if datos_ia:
            # Reutilizamos registrar_transaccion armando un objeto Namespace falso
            args_falsos = argparse.Namespace(**datos_ia)
            # Para la fecha, le permitimos agregar una si la generó, o nulo
            if 'date' not in datos_ia:
                setattr(args_falsos, 'date', None)
            registrar_transaccion(args_falsos)
    else:
        parser.print_help()
