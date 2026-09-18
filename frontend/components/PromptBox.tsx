"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const EJEMPLOS = [
  "Corta los silencios, hazlo dinámico, pon transiciones rápidas y subtítulos llamativos",
  "Subtítulos grandes con borde negro, ritmo rápido y música de fondo",
  "Quita las partes aburridas y deja solo lo mejor, con subtítulos",
];

/** Caja de prompts en lenguaje natural con ejemplos tocables. */
export default function PromptBox({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-white/70">
        ¿Cómo quieres que se edite?
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Descríbelo con tus palabras…"
        className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 p-4
          text-base placeholder:text-white/30 focus:border-brand focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {EJEMPLOS.map((ej) => (
          <button
            key={ej}
            type="button"
            onClick={() => onChange(ej)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5
              text-left text-xs text-white/60 transition active:scale-95 hover:border-brand/60"
          >
            “{ej.slice(0, 42)}…”
          </button>
        ))}
      </div>
    </div>
  );
}
