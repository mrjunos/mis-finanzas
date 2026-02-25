# ⏰ Configuración del Cron de Sincronización Gmail → Firebase

Este cron ejecuta `gmail_finanzas_sync.py` cada 2 minutos para importar transacciones bancarias desde Gmail a Firebase usando IA local (Ollama).

## Prerequisitos

1. **Python 3** instalado
2. **Ollama** corriendo localmente con un modelo (ej: `mistral-nemo`, `llama3`)
3. **Dependencias Python** instaladas:
   ```bash
   pip3 install google-auth google-auth-oauthlib google-api-python-client beautifulsoup4 ollama firebase-admin
   ```
4. **Archivos necesarios** en la carpeta del proyecto:
   - `credentials.json` — OAuth 2.0 de Google Cloud (tipo Desktop App, con Gmail API habilitada)
   - `firebase-adminsdk-fbsvc-bb7cb78f3e.json` — Service Account de Firebase
   - `token.json` — Se genera automáticamente la primera vez que corres el script manualmente

## Primera ejecución (manual)

Antes de configurar el cron, corre el script manualmente para autorizar Gmail:

```bash
cd /ruta/a/tu/proyecto/Finanzas
python3 gmail_finanzas_sync.py --model mistral-nemo
```

Se abrirá un navegador para que autorices el acceso a tu cuenta de Gmail. Esto genera el `token.json`.

## Instalar el Cron

1. Abrir el editor de cron:
   ```bash
   crontab -e
   ```

2. Agregar la siguiente línea (ajustar las rutas a tu Mac):
   ```
   */2 * * * * cd /Users/TU_USUARIO/Documents/Finanzas && /usr/bin/python3 gmail_finanzas_sync.py --model mistral-nemo >> /Users/TU_USUARIO/Documents/Finanzas/cron_sync.log 2>&1
   ```

3. Guardar y cerrar (`:wq` si es vim, `Ctrl+X` si es nano).

4. Verificar que quedó registrado:
   ```bash
   crontab -l
   ```

## Notas importantes

- **`--model`**: Cambia el modelo según lo que tengas en Ollama. Opciones comunes: `llama3`, `mistral-nemo`, `gemma2`.
- **Lock file**: El script crea `gmail_sync.lock` para evitar ejecuciones simultáneas. Si el script anterior no ha terminado, la nueva instancia se sale sin hacer nada.
- **Logs**: Todo se guarda en `cron_sync.log`. Para ver los logs en tiempo real:
  ```bash
  tail -f /Users/TU_USUARIO/Documents/Finanzas/cron_sync.log
  ```
- **Permisos macOS**: Si el cron no funciona, macOS puede estar bloqueando el acceso. Ve a:
  - **Ajustes del Sistema → Privacidad y Seguridad → Acceso total a disco**
  - Agrega `/usr/sbin/cron` (o la terminal que uses)

## Desinstalar el Cron

```bash
crontab -e
# Borra la línea del cron, guarda y cierra
```

O para borrar TODOS los crons:
```bash
crontab -r
```
