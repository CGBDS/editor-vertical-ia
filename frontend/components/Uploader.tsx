"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  onFile: (f: File | null) => void;
}

/** Botón grande de carga con vista previa local del video elegido. */
export default function Uploader({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      alert("Selecciona un archivo de video (MP4, MOV, WEBM).");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    onFile(f);
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (file && preview) {
    return (
      <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/5">
        <div className="flex gap-4 p-4">
          <video
            src={preview}
            muted
            playsInline
            preload="metadata"
            className="aspect-[9/16] w-20 shrink-0 rounded-xl bg-black object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            <p className="mt-1 text-xs text-white/50">
              {(file.size / 1024 / 1024).toFixed(1)} MB · listo para editar
            </p>
            <button
              onClick={clear}
              className="mt-3 rounded-full border border-white/15 px-4 py-1.5 text-xs
                text-white/60 transition active:scale-95 hover:border-red-400/60 hover:text-red-300"
            >
              Cambiar video
            </button>
          </div>
          <span className="text-xl">✓</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`w-full rounded-3xl border-2 border-dashed border-white/20 bg-white/5
          px-6 py-14 text-center transition active:scale-[0.99] min-h-[220px]
          flex flex-col items-center justify-center gap-3 ${drag ? "dropzone-active" : ""}`}
      >
        <span className="text-5xl">🎬</span>
        <span className="text-xl font-bold">Toca para subir tu video</span>
        <span className="text-sm text-white/50">
          o arrástralo aquí · MP4, MOV, WEBM · sin límite de duración
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
