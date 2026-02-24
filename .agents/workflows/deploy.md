---
description: Cómo hacer deploy de una nueva versión después de hacer cambios en GitHub
---

# Deploy desde cero (después de cambios en GitHub)

Si hiciste cambios directamente en GitHub (ej. desde el celular) y quieres deployar:

// turbo-all

1. Asegúrate de estar en la rama `main`:
```bash
git checkout main
```

2. Trae los últimos cambios:
```bash
git pull origin main
```

3. Instala dependencias por si hay cambios:
```bash
npm install
```

4. Compila el proyecto:
```bash
npm run build
```

5. Deploya a Firebase Hosting:
```bash
firebase deploy --only hosting
```

Tu app estará actualizada en: **https://mis-finanzas-jj.web.app**

---

## Comando rápido (todo en uno)

```bash
git pull origin main && npm run build && firebase deploy --only hosting
```
