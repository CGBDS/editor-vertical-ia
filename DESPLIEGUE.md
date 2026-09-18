# DESPLIEGUE GRATIS — Editor Vertical IA

Tu app (frontend + backend + FFmpeg) empaquetada en un solo contenedor Docker,
lista para subir a un hosting gratuito y obtener un **link público**.

## Opción A — Render (recomendado, ~10 minutos)

1. **Sube el proyecto a GitHub**
   - Crea un repositorio nuevo en https://github.com/new (público o privado).
   - Sube el contenido de la carpeta `editor-vertical/` a la raíz del repo
     (debe quedar `Dockerfile` y `render.yaml` en la raíz).

2. **Conecta Render**
   - Entra a https://dashboard.render.com → **New +** → **Blueprint**.
   - Conecta tu cuenta de GitHub y elige el repositorio.
   - Render detecta `render.yaml` automáticamente → dale a **Apply**.
   - Plan **Free** (ya viene seleccionado en el blueprint).

3. **Espera el primer build** (5–10 min la primera vez).
   - Cuando el estado sea **Live**, Render te da la URL pública, algo como
     `https://editor-vertical-ia.onrender.com`.
   - Ese link lo abres tú y se lo pasas a tus amigos. Funciona igual para todos.

## Límites del plan gratuito (importante)

- **Se duerme** tras ~15 min sin uso: la primera visita después de un rato
  tarda ~1 minuto en "despertar". Avisale a tus amigos.
- **1 video a la vez** (`MAX_CONCURRENT_JOBS=1`): si dos personas procesan a la
  vez, el segundo espera en cola.
- **Disco efímero**: los videos se borran solos a las 6 horas (`RETENTION_HOURS`).
- **Sin subtítulos automáticos por IA**: Whisper no está instalado en el
  contenedor; los subtítulos se queman desde el texto que escriba el usuario.
- Máquina pequeña: mejor con **clips cortos** (reels, tiktoks).

## Personalizar la marca (opcional)

- **Watermark real**: reemplaza `assets/watermark.png` por tu logo CGB
  (el contenedor trae uno provisional con el texto "CGB").
- **Impact real**: coloca tu archivo en `assets/fonts/impact.ttf`
  (el contenedor usa una fuente de respaldo pesada si no está).
- Tras cambiar assets, en Render dale a **Manual Deploy → Deploy latest commit**.

## Opción B — Hugging Face Spaces (alternativa gratis)

1. Crea un Space en https://huggingface.co/new-space → SDK **Docker**.
2. Sube los mismos archivos (`Dockerfile` en la raíz).
3. El Space te da URL pública. Máquina gratuita similar a Render.

## Desarrollo local

```bash
cd backend && npm install && npm start   # http://localhost:4000 (solo API)
cd frontend && npm install && npm run dev # http://localhost:3000
```

El backend sirve el frontend automáticamente cuando existe `FRONTEND_DIR`
(ver `backend/.env.example`).
