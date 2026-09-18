"use client";

interface Props {
  progress: number; // 0..100
  status: string;
  onCancel: () => void;
}

/** Barra de progreso con fase, porcentaje y botón de cancelar. */
export default function ProgressBar({ progress, status, onCancel }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-white/80">{status}</span>
        <span className="tabular-nums font-bold text-brand">{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="progress-anim h-full rounded-full bg-gradient-to-r from-brand to-fuchsia-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">
          Los videos largos pueden tomar unos minutos.
        </p>
        <button
          onClick={onCancel}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs
            text-white/60 transition active:scale-95 hover:border-red-400/60 hover:text-red-300"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
