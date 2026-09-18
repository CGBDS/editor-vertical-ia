# Editor Vertical IA — Reels/TikTok 9:16

Aplicación web full-stack para edición automática de videos verticales (1080×1920)
impulsada por prompts en lenguaje natural.

## Estructura

```
editor-vertical/
├── frontend/          # Next.js 14 + Tailwind (mobile-first)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # flujo: subir → prompt → progreso → preview → descargar
│   │   └── globals.css
│   ├── components/
│   │   ├── Uploader.tsx      # drag & drop + galería, botón grande
│   │   ├── PromptBox.tsx     # caja de prompts con ejemplos
│   │   ├── ProgressBar.tsx   # estado del procesamiento (polling)
│   │   └── PreviewPlayer.tsx # reproductor vertical 9:16 + descarga
│   └── lib/api.ts            # cliente HTTP del backend
├── backend/           # Node.js + Express + FFmpeg
│   ├── server.js             # API: upload, jobs, result
│   ├── processor.js          # pipeline FFmpeg (9:16, subtítulos, watermark)
│   ├── promptParser.js       # interpreta el prompt → directivas de edición
│   └── .env.example
└── assets/
    ├── watermark.png  # ← coloca aquí el logo CGB (se aplica automático)
    └── fonts/
        └── impact.ttf  # ← tipografía Impact (requerida para subtítulos)
```

## Requisitos

- Node.js 18+
- FFmpeg 5+ en el PATH (`ffmpeg -version`)
- (Opcional) `faster-whisper` para subtítulos automáticos desde el audio

## Puesta en marcha

```bash
# 1. Backend
cd backend && npm install && cp .env.example .env
# edita .env: WATERMARK_PATH, FONT_PATH, PORT
npm start   # http://localhost:4000

# 2. Frontend
cd frontend && npm install && npm run dev
# http://localhost:3000  (usa NEXT_PUBLIC_API_URL=http://localhost:4000)
```

## Pipeline de renderizado (automático, no visible al usuario)

1. **Normalización 9:16** — Si el video ya es vertical se escala directo (más rápido
   y nítido); si es horizontal, se reencuadra con fondo difuminado + video centrado.
   Salida siempre 1080×1920.
2. **Directivas del prompt** — `promptParser.js` detecta: quitar silencios,
   subtítulos, ritmo dinámico, transiciones (fundido entrada/salida) y música de fondo.
3. **Subtítulos** — Quemados con Impact + borde negro (stroke), estilo reels virales.
4. **Marca de agua CGB** — Aplicada por código en la esquina inferior derecha,
   pequeña, opacidad 45%. Obligatoria en todos los renders; el backend no arranca sin ella.
5. **Salida** — H.264 + AAC, `result-<jobId>.mp4` listo para descargar.

## API

| Método | Ruta              | Descripción                                              |
|--------|-------------------|----------------------------------------------------------|
| POST   | `/api/upload`     | `multipart/form-data`: `video` + `prompt` → `{ jobId, directives }` |
| GET    | `/api/jobs/:id`   | `{ status, progress, error?, resultUrl? }`               |
| DELETE | `/api/jobs/:id`   | Cancela el trabajo (mata FFmpeg) y limpia archivos       |
| GET    | `/api/result/:id` | Descarga el MP4 final                                    |
| GET    | `/api/health`     | `{ ok, running, queued, maxConcurrent }`                 |

## Operación

- **Cola con concurrencia**: `MAX_CONCURRENT_JOBS` (default 2) trabajos FFmpeg a la vez.
- **Limpieza automática**: subidas y resultados viejos se borran tras `RETENTION_HOURS` (default 24).
- **Chequeo al arrancar**: verifica FFmpeg/FFprobe, `watermark.png` e `impact.ttf`;
  si falta algo obligatorio, el backend no arranca y dice exactamente qué falta.
