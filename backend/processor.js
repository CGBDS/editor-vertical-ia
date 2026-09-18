/**
 * processor.js
 * Pipeline de renderizado FFmpeg. Todo lo de marca (watermark CGB,
 * tipografía Impact) se aplica aquí por código, de forma automática
 * y obligatoria — invisible para el usuario final.
 */
import { spawn, execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

const WATERMARK = path.resolve(process.env.WATERMARK_PATH || "../assets/watermark.png");
// Tipografía: Impact si existe, si no usa la de respaldo (Anton, OFL) con aviso.
// Para producción real, coloca assets/fonts/impact.ttf
const FONT_CANDIDATES = [
  path.resolve(process.env.FONT_PATH || "../assets/fonts/impact.ttf"),
  path.resolve("../assets/fonts/fallback.ttf"),
];
const FONT = FONT_CANDIDATES.find((p) => fs.existsSync(p)) || FONT_CANDIDATES[0];
const FONT_IS_FALLBACK = FONT === FONT_CANDIDATES[1];
const BGM = process.env.BGM_PATH ? path.resolve(process.env.BGM_PATH) : null;
const OUT_DIR = path.resolve(process.env.OUTPUT_DIR || "./outputs");

// Marca de agua: esquina inferior derecha, pequeña, 45% opacidad
const WM_WIDTH = 140;
const WM_OPACITY = 0.45;
const WM_MARGIN = 36;

// Procesos ffmpeg activos por jobId (para cancelación)
const active = new Map();

export function cancelProcess(jobId) {
  const p = active.get(jobId);
  if (p) {
    try { p.kill("SIGKILL"); } catch {}
    active.delete(jobId);
    return true;
  }
  return false;
}

/** Verifica dependencias y assets al arrancar. Falla rápido con mensaje claro. */
export function checkEnvironment() {
  const problems = [];
  for (const bin of ["ffmpeg", "ffprobe"]) {
    try { execFileSync(bin, ["-version"], { stdio: "ignore" }); }
    catch { problems.push(`No se encontró '${bin}' en el PATH`); }
  }
  if (!fs.existsSync(WATERMARK))
    problems.push(`Falta la marca de agua: ${WATERMARK} (obligatoria)`);
  if (!fs.existsSync(FONT))
    problems.push(`Falta toda tipografía (ni Impact ni respaldo): ${FONT_CANDIDATES.join(", ")}`);
  else if (FONT_IS_FALLBACK)
    problems.push(`Aviso: se usará la tipografía de respaldo (no es Impact). Coloca assets/fonts/impact.ttf para la versión final.`);
  if (BGM && !fs.existsSync(BGM))
    problems.push(`BGM_PATH no existe: ${BGM} (se omitirá la música)`);
  return problems;
}

/** Dimensiones y duración via ffprobe */
async function probe(input) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=width,height,codec_type",
    "-of", "json", input,
  ]);
  const j = JSON.parse(stdout);
  const vs = (j.streams || []).find((s) => s.codec_type === "video") || {};
  return {
    duration: parseFloat(j.format?.duration) || 0,
    width: vs.width || 0,
    height: vs.height || 0,
  };
}

/** Subtítulos automáticos con Whisper (opcional). Devuelve ruta .srt o null. */
async function autoSubtitles(input, workDir) {
  const cmd = process.env.WHISPER_CMD;
  if (!cmd) return null;
  const srt = path.join(workDir, "subs.srt");
  try {
    await execFileAsync("bash", ["-lc", `${cmd} "${input}" --output "${srt}"`], { timeout: 900000 });
    return fs.existsSync(srt) ? srt : null;
  } catch {
    return null;
  }
}

/**
 * Construye el filtergraph de video según las directivas.
 * Salida garantizada: 1080x1920.
 */
function buildVideoFilter(d, srtPath, meta) {
  const vf = [];
  const alreadyVertical =
    meta.width > 0 && Math.abs(meta.width / meta.height - 9 / 16) < 0.02;

  if (alreadyVertical) {
    // Ya es 9:16: solo escalar, sin fondo difuminado (más rápido, más nítido)
    vf.push("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[vbase]");
  } else {
    // Reencuadre inteligente: fondo difuminado + video centrado
    vf.push(
      "split=2[bg][fg]",
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bgf]",
      "[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fgf]",
      "[bgf][fgf]overlay=(W-w)/2:(H-h)/2,setsar=1[vbase]"
    );
  }

  let v = "vbase";

  // Ritmo dinámico: punch de color/contraste estilo reels
  if (d.dynamic) {
    vf.push(`[${v}]eq=contrast=1.08:saturation=1.18[v1]`);
    v = "v1";
  }

  // Transiciones: fundido de entrada y salida
  if (d.transitions && meta.duration > 1) {
    const out = Math.max(0, meta.duration - 0.5).toFixed(2);
    vf.push(`[${v}]fade=t=in:st=0:d=0.4,fade=t=out:st=${out}:d=0.5[v2]`);
    v = "v2";
  }

  // Subtítulos quemados: Impact + borde negro (estilo viral)
  if (d.captions && srtPath) {
    const esc = srtPath.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    const style = [
      "FontName=Impact", "FontSize=26",
      "PrimaryColour=&H00FFFFFF", "OutlineColour=&H80000000",
      "BorderStyle=1", "Outline=3", "Shadow=0",
      "Alignment=2", "MarginV=140",
    ].join(",");
    vf.push(`[${v}]subtitles='${esc}':force_style='${style}'[v3]`);
    v = "v3";
  }

  // Marca de agua CGB — OBLIGATORIA, inferior derecha, 45% opacidad.
  // [1:v] = watermark.png (segundo input)
  vf.push(
    `[1:v]scale=${WM_WIDTH}:-1,format=rgba,colorchannelmixer=aa=${WM_OPACITY}[wm]`,
    `[${v}][wm]overlay=W-w-${WM_MARGIN}:H-h-${WM_MARGIN}:format=auto,format=yuv420p[vout]`
  );

  return vf.join(";");
}

function buildAudioFilter(d, hasBgm) {
  const af = [];
  if (d.removeSilence) {
    af.push("silenceremove=start_periods=1:start_duration=0.4:start_threshold=-35dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB");
  }
  // Música de fondo opcional: mezcla bajo el audio original
  if (hasBgm) {
    // [0:a] voz, [2:a] música → amix con la música al 15%
    return {
      complex: "[0:a]aresample=48000,volume=1.0[voice];[2:a]aresample=48000,volume=0.15,aloop=loop=-1:size=2e9[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0[aout]",
      map: "[aout]",
    };
  }
  af.push("aresample=48000");
  return { complex: null, filter: af.join(","), map: "0:a?" };
}

/**
 * Procesa un video. onProgress(pct 0..100).
 * @returns {Promise<string>} ruta del MP4 final
 */
export async function processVideo({ input, jobId, directives, onProgress }) {
  if (!fs.existsSync(WATERMARK))
    throw new Error("Falta assets/watermark.png — la marca de agua CGB es obligatoria");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const workDir = path.join(OUT_DIR, jobId);
  fs.mkdirSync(workDir, { recursive: true });

  const meta = await probe(input);
  const srt = directives.captions ? await autoSubtitles(input, workDir) : null;
  const useBgm = Boolean(directives.bgm && BGM && fs.existsSync(BGM));

  const vf = buildVideoFilter(directives, srt, meta);
  const au = buildAudioFilter(directives, useBgm);
  const output = path.join(OUT_DIR, `result-${jobId}.mp4`);

  const inputs = ["-i", input, "-i", WATERMARK];
  if (useBgm) inputs.push("-i", BGM);

  const filterComplex = au.complex
    ? `${vf};${au.complex}`
    : vf;

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", "[vout]",
    "-map", au.map,
  ];
  if (au.filter) args.push("-af", au.filter);
  args.push(
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    "-progress", "pipe:1",
    "-nostats",
    output,
  );

  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args);
    active.set(jobId, ff);
    let stderrTail = "";
    ff.stdout.on("data", (chunk) => {
      const s = String(chunk);
      const m = s.match(/out_time_ms=(\d+)/);
      if (m && meta.duration > 0) {
        onProgress?.(Math.min(99, (parseInt(m[1], 10) / 1e6 / meta.duration) * 100));
      }
      if (s.includes("progress=end")) {
        onProgress?.(100);
        active.delete(jobId);
        resolve();
      }
    });
    ff.stderr.on("data", (c) => {
      stderrTail = (stderrTail + c).slice(-2000);
    });
    ff.on("error", (e) => { active.delete(jobId); reject(e); });
    ff.on("close", (code, signal) => {
      active.delete(jobId);
      if (signal) return reject(new Error("Procesamiento cancelado"));
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg falló (código ${code}). ${stderrTail.slice(-300)}`));
    });
  });

  return output;
}
