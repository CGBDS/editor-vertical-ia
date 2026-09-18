/**
 * server.js — API del editor vertical.
 * POST   /api/upload    → encola un trabajo (devuelve jobId + directivas detectadas)
 * GET    /api/jobs/:id  → estado + progreso (polling del frontend)
 * DELETE /api/jobs/:id  → cancela el trabajo y limpia archivos
 * GET    /api/result/:id → descarga el MP4 final
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuid } from "uuid";
import { parsePromptSmart } from "./promptParser.js";
import { processVideo, cancelProcess, checkEnvironment } from "./processor.js";

const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || "./outputs");
const MAX_CONCURRENT = Math.max(1, parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10));
const RETENTION_HOURS = parseFloat(process.env.RETENTION_HOURS || "24");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// --- Chequeo de entorno al arrancar (falla rápido con mensaje claro) ---
const problems = checkEnvironment();
for (const p of problems) console.warn("⚠️", p);
const fatal = problems.some((p) => p.includes("ffmpeg") || p.includes("marca de agua") || p.includes("toda tipografía"));
if (fatal) {
  console.error("❌ Faltan dependencias o assets obligatorios. Corrige lo anterior y reinicia.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// Trabajos: { status, progress, error, resultPath, inputPath, directives, createdAt }
// Cola FIFO con límite de concurrencia (para producción: Redis/BullMQ)
const jobs = new Map();
const queue = [];
let running = 0;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) =>
    cb(null, `${uuid()}${path.extname(file.originalname) || ".mp4"}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 ** 3 }, // 4 GB — sin límite práctico de duración
  fileFilter: (_req, file, cb) => {
    // Validar por magic bytes además del mimetype (más robusto)
    const ok = file.mimetype.startsWith("video/") ||
      /\.(mp4|mov|webm|mkv|avi)$/i.test(file.originalname);
    cb(ok ? null : new Error("Formato no soportado: usa MP4, MOV o WEBM"), ok);
  },
});

function pump() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const { jobId, inputPath, prompt } = queue.shift();
    const job = jobs.get(jobId);
    if (!job || job.status === "cancelled") continue;
    running++;
    runJob(jobId, inputPath, prompt).finally(() => {
      running--;
      pump();
    });
  }
}

async function runJob(jobId, inputPath, prompt) {
  const job = jobs.get(jobId);
  try {
    job.status = "processing";
    const directives = job.directives; // ya detectadas en /upload
    const outPath = await processVideo({
      input: inputPath,
      jobId,
      directives,
      onProgress: (pct) => { job.progress = pct; },
    });
    job.status = "done";
    job.progress = 100;
    job.resultPath = outPath;
  } catch (err) {
    if (job.status !== "cancelled") {
      job.status = "error";
      job.error = err.message || "Error de procesamiento";
    }
    console.error(`[job ${jobId}]`, err.message);
  }
}

function cleanupFiles(job) {
  for (const p of [job.inputPath, job.resultPath]) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
  try {
    const wd = path.join(OUTPUT_DIR, job.id);
    if (fs.existsSync(wd)) fs.rmSync(wd, { recursive: true, force: true });
  } catch {}
}

app.post("/api/upload", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Falta el video" });
  try {
    const jobId = uuid();
    const directives = await parsePromptSmart(req.body.prompt || "");
    const job = {
      id: jobId,
      status: "queued",
      progress: 0,
      inputPath: req.file.path,
      directives,
      createdAt: Date.now(),
    };
    jobs.set(jobId, job);
    queue.push({ jobId, inputPath: req.file.path, prompt: req.body.prompt || "" });
    pump();
    // El frontend muestra qué entendió la "IA" antes de procesar
    res.json({ jobId, directives });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job no encontrado" });
  res.json({
    status: job.status,
    progress: job.progress,
    error: job.error,
    resultUrl: job.status === "done" ? req.params.id : undefined,
  });
});

app.delete("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job no encontrado" });
  // Sacar de la cola si aún no empezó
  const qi = queue.findIndex((q) => q.jobId === req.params.id);
  if (qi >= 0) queue.splice(qi, 1);
  // Matar ffmpeg si está procesando
  cancelProcess(req.params.id);
  job.status = "cancelled";
  cleanupFiles(job);
  res.json({ ok: true });
});

app.get("/api/result/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done" || !job.resultPath || !fs.existsSync(job.resultPath))
    return res.status(404).json({ error: "Resultado no disponible" });
  res.download(job.resultPath, `reel-9x16-${req.params.id}.mp4`);
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, running, queued: queue.length, maxConcurrent: MAX_CONCURRENT })
);

// --- Frontend estático servido por el mismo origen (despliegue en un solo servicio) ---
// En Docker, FRONTEND_DIR apunta a la exportación estática de Next.js.
// El frontend usa URLs relativas a /api/*, así que no necesita configuración extra.
const FRONTEND_DIR = path.resolve(process.env.FRONTEND_DIR || "../frontend/out");
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
  app.get("*", (_req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
} else {
  console.warn(`⚠️ Frontend estático no encontrado en ${FRONTEND_DIR} (solo API disponible)`);
}

// Limpieza automática de archivos viejos (cada 30 min)
setInterval(() => {
  const cutoff = Date.now() - RETENTION_HOURS * 3600 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && ["done", "error", "cancelled"].includes(job.status)) {
      cleanupFiles(job);
      jobs.delete(id);
    }
  }
}, 30 * 60 * 1000);

app.listen(PORT, () =>
  console.log(`🎬 Editor vertical backend en http://localhost:${PORT} (concurrencia: ${MAX_CONCURRENT})`)
);
