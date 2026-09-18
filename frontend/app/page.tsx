"use client";
import { useEffect, useRef, useState } from "react";
import Uploader from "../components/Uploader";
import PromptBox from "../components/PromptBox";
import ProgressBar from "../components/ProgressBar";
import PreviewPlayer from "../components/PreviewPlayer";
import StepIndicator from "../components/StepIndicator";
import {
  uploadVideo, getJob, cancelJob, resultUrl,
  JobStatus, Directives, DIRECTIVE_LABELS,
} from "../lib/api";

type Phase = "form" | "uploading" | "working" | "done" | "error";

const STATUS_LABEL: Record<string, string> = {
  queued: "En cola…",
  processing: "Procesando video…",
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [uploadPct, setUploadPct] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [directives, setDirectives] = useState<Directives | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stopPolling, []);

  const stepIndex =
    phase === "form" ? (file ? 1 : 0)
    : phase === "uploading" || phase === "working" ? 2
    : phase === "done" ? 3 : 2;

  const start = async () => {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setUploadPct(0);
    try {
      const { jobId: id, directives: det } = await uploadVideo(file, prompt, setUploadPct);
      setJobId(id);
      setDirectives(det);
      setPhase("working");
      timer.current = setInterval(async () => {
        try {
          const st = await getJob(id);
          setJob(st);
          if (st.status === "done" || st.status === "error" || st.status === "cancelled") {
            stopPolling();
            if (st.status === "done") setPhase("done");
            else {
              setPhase("error");
              setError(st.error || "Procesamiento cancelado");
            }
          }
        } catch (e: any) {
          stopPolling();
          setPhase("error");
          setError(e.message);
        }
      }, 2000);
    } catch (e: any) {
      setPhase("error");
      setError(e.message);
    }
  };

  const cancel = async () => {
    stopPolling();
    if (jobId) {
      try { await cancelJob(jobId); } catch {}
    }
    reset();
  };

  const reset = () => {
    stopPolling();
    setFile(null);
    setPrompt("");
    setJobId(null);
    setJob(null);
    setDirectives(null);
    setError(null);
    setUploadPct(0);
    setPhase("form");
  };

  const activeDirectives = directives
    ? (Object.keys(DIRECTIVE_LABELS) as (keyof typeof DIRECTIVE_LABELS)[])
        .filter((k) => directives[k])
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8 pb-16">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight">
          Editor Vertical <span className="text-brand">IA</span>
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Sube tu video, descríbelo y recibe un Reel 9:16 listo para publicar.
        </p>
      </header>

      <StepIndicator current={stepIndex} />

      {phase === "form" && (
        <>
          <Uploader onFile={setFile} />
          <PromptBox value={prompt} onChange={setPrompt} />
          <button
            onClick={start}
            disabled={!file}
            className="w-full rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-black
              transition active:scale-[0.98] disabled:opacity-30 hover:brightness-110"
          >
            ✨ Editar mi video
          </button>
        </>
      )}

      {phase === "uploading" && (
        <ProgressBar progress={uploadPct} status="Subiendo video…" onCancel={cancel} />
      )}

      {phase === "working" && (
        <div className="space-y-4">
          <ProgressBar
            progress={job?.progress ?? 2}
            status={job ? STATUS_LABEL[job.status] ?? job.status : "Preparando…"}
            onCancel={cancel}
          />
          {activeDirectives.length > 0 && (
            <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
              <p className="mb-2 text-xs font-semibold text-brand">🤖 Entendí que quieres:</p>
              <div className="flex flex-wrap gap-2">
                {activeDirectives.map((k) => (
                  <span key={k} className="rounded-full bg-brand/20 px-3 py-1 text-xs text-white">
                    {DIRECTIVE_LABELS[k]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "done" && job?.resultUrl && (
        <>
          <PreviewPlayer src={resultUrl(job.resultUrl)} fileName="reel-9x16.mp4" />
          <button
            onClick={reset}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-3
              font-semibold text-white/70 transition active:scale-[0.98]"
          >
            Editar otro video
          </button>
        </>
      )}

      {phase === "error" && (
        <div className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="font-semibold text-red-300">Algo salió mal</p>
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={reset}
            className="w-full rounded-2xl bg-white/10 px-6 py-3 font-semibold"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </main>
  );
}
