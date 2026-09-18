# ── Etapa 1: compila el frontend (Next.js → exportación estática) ──
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
# NEXT_PUBLIC_API_URL vacío = el frontend llama a /api/* en el mismo origen
RUN npm run build

# ── Etapa 2: backend + FFmpeg + frontend estático en un solo servicio ──
FROM node:20-slim AS app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
COPY backend/ ./

# Assets de marca
WORKDIR /app
COPY assets/ ./assets/
# Tipografía de respaldo (Anton, licencia OFL). Si colocas assets/fonts/impact.ttf,
# el procesador la prefiere automáticamente.
RUN mkdir -p assets/fonts && \
    curl -sSL -o assets/fonts/fallback.ttf \
      "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf" && \
    ls -la assets/fonts/
# Watermark provisional "CGB" (transparente). Reemplázalo por tu PNG real.
RUN if [ ! -f assets/watermark.png ]; then \
      ffmpeg -y -v error -f lavfi -i "color=0x00000000:size=440x160:duration=1" \
        -vf "drawtext=fontfile=/app/assets/fonts/fallback.ttf:text='CGB':fontcolor=white:fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2" \
        -frames:v 1 assets/watermark.png; \
    fi && ls -la assets/

# Frontend estático servido por el backend
COPY --from=web /web/out /app/public

ENV PORT=4000 \
    UPLOAD_DIR=/app/data/uploads \
    OUTPUT_DIR=/app/data/outputs \
    FRONTEND_DIR=/app/public \
    MAX_CONCURRENT_JOBS=1 \
    RETENTION_HOURS=6

RUN mkdir -p /app/data/uploads /app/data/outputs
EXPOSE 4000
WORKDIR /app/backend
CMD ["node", "server.js"]
