# ⏰ Configuración del Cron de Sincronización Gmail → Firebase

Este cron ejecuta `gmail_finanzas_sync.py` cada 2 minutos para importar transacciones bancarias desde Gmail a Firebase usando IA local (Ollama).

---

## Prerequisitos

- **Python 3.14** via Homebrew (`/opt/homebrew/bin/python3`)
- **Ollama** corriendo localmente con un modelo (ej: `mistral-nemo`, `llama3`)

---

## Checklist de setup (máquina nueva)

### 1. Instalar Python 3.14 via Homebrew

```bash
brew install python@3.14
```

Verificar que la versión correcta es la activa:

```bash
/opt/homebrew/bin/python3 --version   # debe mostrar Python 3.14.x
```

### 2. Clonar el repositorio

```bash
git clone <repo-url> ~/Documents/Finanzas
cd ~/Documents/Finanzas
```

### 3. Instalar dependencias Python

```bash
/opt/homebrew/bin/pip3 install -r requirements.txt
```

### 4. Obtener y colocar los archivos secretos

Necesitas dos archivos que **no están en el repositorio** (están en `.gitignore`):

| Archivo | Dónde obtenerlo |
|---------|----------------|
| `credentials.json` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (tipo Desktop App, con Gmail API habilitada) → Descargar JSON |
| `firebase-adminsdk-fbsvc-bb7cb78f3e.json` | Firebase Console → Project Settings → Service Accounts → Generate new private key |

Coloca ambos archivos en `~/Documents/Finanzas/`.

### 5. Primera ejecución manual (genera `token.json`)

Antes de configurar el cron, corre el script manualmente para autorizar Gmail:

```bash
cd ~/Documents/Finanzas
/opt/homebrew/bin/python3 gmail_finanzas_sync.py --model mistral-nemo
```

Se abrirá un navegador para que autorices el acceso a tu cuenta de Gmail. Esto genera `token.json` automáticamente. Este archivo tampoco está en el repositorio.

---

## Deduplicación

El script registra cada correo procesado en la colección `processed_gmail_ids` de Firestore. El document ID es el Gmail message ID y tiene un solo campo:

```
processed_gmail_ids/{message_id}
  └── processed_at: "2026-03-03T20:21:49.737014"  (ISO UTC)
```

Esto permite correr el script desde cualquier equipo sin perder el estado de sincronización.

---

## Inspección y depuración de correos procesados

`bot_finanzas_ejemplo.py` incluye comandos para inspeccionar y limpiar el registro de correos procesados, útil durante pruebas o para forzar el reprocesamiento de un correo.

### Listar los últimos procesados

```bash
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py processed           # últimos 10 (por defecto)
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py processed --limit 5
```

Muestra una tabla `ID | processed_at` ordenada del más reciente al más antiguo.

### Eliminar un ID para reprocesarlo

```bash
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py unprocess 19b7fad473750518
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py unprocess 19b7fad473750518 19b7c6be70ba46e5
```

Elimina el documento de Firestore. La próxima vez que corra el cron, ese correo volverá a procesarse si sigue etiquetado en Gmail.

---

## Instalar el Cron

1. Abrir el editor de cron:
   ```bash
   crontab -e
   ```

2. Agregar la siguiente línea (ajustar `TU_USUARIO`):
   ```
   */2 * * * * cd /Users/TU_USUARIO/Documents/Finanzas && /opt/homebrew/bin/python3 gmail_finanzas_sync.py --model mistral-nemo >> /Users/TU_USUARIO/Documents/Finanzas/cron_sync.log 2>&1
   ```

3. Guardar y cerrar (`:wq` si es vim, `Ctrl+X` si es nano).

4. Verificar que quedó registrado:
   ```bash
   crontab -l
   ```

---

## Notas importantes

- **`--model`**: Cambia el modelo según lo que tengas en Ollama. Opciones comunes: `llama3`, `mistral-nemo`, `gemma2`.
- **Lock file**: El script crea `gmail_sync.lock` para evitar ejecuciones simultáneas. Si el script anterior no ha terminado, la nueva instancia se sale sin hacer nada.
- **Logs**: Todo se guarda en `cron_sync.log`. Para ver los logs en tiempo real:
  ```bash
  tail -f ~/Documents/Finanzas/cron_sync.log
  ```
- **Permisos macOS**: Si el cron no funciona, macOS puede estar bloqueando el acceso. Ve a:
  - **Ajustes del Sistema → Privacidad y Seguridad → Acceso total a disco**
  - Agrega `/usr/sbin/cron` (o la terminal que uses)
- **Dependabot**: El repositorio tiene `.github/dependabot.yml` configurado para revisar actualizaciones de `requirements.txt` cada lunes y abrir PRs automáticamente.

---

## Desinstalar el Cron

```bash
crontab -e
# Borra la línea del cron, guarda y cierra
```

O para borrar TODOS los crons:
```bash
crontab -r
```
