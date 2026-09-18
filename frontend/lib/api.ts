const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export interface Directives {
  removeSilence: boolean;
  captions: boolean;
  dynamic: boolean;
  transitions: boolean;
  bgm: boolean;
  raw?: string;
}

export interface JobStatus {
  status: "queued" | "processing" | "done" | "error" | "cancelled";
  progress: number; // 0..100
  error?: string;
  resultUrl?: string;
}

export const DIRECTIVE_LABELS: Record<keyof Omit<Directives, "raw">, string> = {
  removeSilence: "Quitar silencios",
  captions: "Subtítulos",
  dynamic: "Ritmo dinámico",
  transitions: "Transiciones",
  bgm: "Música de fondo",
};

/** Subida con progreso real (XHR). Devuelve jobId + directivas detectadas. */
export function uploadVideo(
  file: File,
  prompt: string,
  onUploadProgress?: (pct: number) => void
): Promise<{ jobId: string; directives: Directives }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("video", file);
    fd.append("prompt", prompt);
    xhr.open("POST", `${API_BASE}/api/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `Upload falló (${xhr.status})`));
      } catch {
        reject(new Error(`Upload falló (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el video"));
    xhr.onabort = () => reject(new Error("Subida cancelada"));
    xhr.send(fd);
  });
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Job no encontrado (${res.status})`);
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/jobs/${jobId}`, { method: "DELETE" });
}

export function resultUrl(jobId: string): string {
  return `${API_BASE}/api/result/${jobId}`;
}
