"use client";

interface Props {
  src: string;
  fileName: string;
}

/** Reproductor vertical 9:16 con descarga en alta calidad. */
export default function PreviewPlayer({ src, fileName }: Props) {
  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full object-contain"
        />
      </div>
      <a
        href={src}
        download={fileName}
        className="block w-full rounded-2xl bg-brand px-6 py-4 text-center text-lg
          font-bold text-black transition active:scale-[0.98] hover:brightness-110"
      >
        ⬇ Descargar en alta calidad (1080×1920)
      </a>
      <p className="text-center text-xs text-white/40">
        Listo para subir a Reels, TikTok o Shorts.
      </p>
    </div>
  );
}
