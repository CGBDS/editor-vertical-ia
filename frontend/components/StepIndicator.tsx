"use client";

const STEPS = ["Subir", "Describir", "Procesar", "Descargar"];

interface Props {
  current: number; // 0..3
}

/** Indicador de pasos del flujo. */
export default function StepIndicator({ current }: Props) {
  return (
    <ol className="flex items-center justify-between px-1">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition
                  ${done ? "bg-brand text-black" : active ? "border-2 border-brand text-brand" : "border border-white/20 text-white/40"}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-[11px] ${active ? "text-white font-semibold" : "text-white/40"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 mb-6 h-px flex-1 ${done ? "bg-brand" : "bg-white/15"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
