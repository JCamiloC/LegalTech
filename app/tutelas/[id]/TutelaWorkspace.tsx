"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TutelaFlowState, TutelaVeredicto } from "@/modules/llm/tutela-flow";
import { veredictoLabel } from "@/modules/llm/tutela-flow";

interface TutelaWorkspaceProps {
  tutelaId: string;
  initialFlow: TutelaFlowState;
}

const QUICK_REPLIES = [
  { label: "De acuerdo", text: "Estoy de acuerdo con el análisis y el veredicto propuesto." },
  { label: "Falta fundamento", text: "El análisis va bien, pero necesito complementar el fundamento. Indica qué norma o hecho falta." },
  { label: "Otro veredicto", text: "Quiero cambiar el veredicto. Propón la alternativa más sólida y explica por qué." },
];

export default function TutelaWorkspace({ tutelaId, initialFlow }: TutelaWorkspaceProps) {
  const [flow, setFlow] = useState<TutelaFlowState>(initialFlow);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const confirmed = flow.veredicto_confirmado;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [flow.messages.length, busy]);

  useEffect(() => {
    if (started.current || initialFlow.messages.length > 0) {
      return;
    }
    started.current = true;
    void send(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(message?: string, bootstrap = false) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tutelas/${tutelaId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bootstrap ? { bootstrap: true } : { message }),
      });
      const data = (await response.json()) as { flow?: TutelaFlowState; error?: string };
      if (data.flow) setFlow(data.flow);
      if (data.error) setError(data.error);
    } catch {
      setError("No se pudo contactar al asistente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(veredicto: TutelaVeredicto) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tutelas/${tutelaId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veredicto }),
      });
      const data = (await response.json()) as { flow?: TutelaFlowState; error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo confirmar.");
        return;
      }
      if (data.flow) setFlow(data.flow);
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft(form: HTMLFormElement) {
    setBusy(true);
    setError(null);
    setDownloaded(false);
    try {
      const response = await fetch(`/api/tutelas/${tutelaId}/draft`, {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo generar el Word.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `borrador-tutela.docx`;
      link.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = useMemo(
    () => !confirmed && flow.veredicto !== "pendiente" && flow.messages.some((item) => item.role === "assistant"),
    [confirmed, flow]
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 className="font-semibold tracking-tight">Conversación</h2>
          <p className="text-xs text-slate-500">La IA propone. Tú confirmas. Nada de esto es la decisión judicial.</p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-slate-700">
          {veredictoLabel(flow.veredicto)}
        </span>
      </header>

      <div ref={scroller} className="max-h-[480px] space-y-3 overflow-y-auto bg-[#faf8f4] px-4 py-5 sm:px-6">
        {flow.messages.length === 0 && busy ? (
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Leyendo el expediente y la biblioteca…
          </div>
        ) : null}
        {flow.messages.map((item, index) => (
          <article
            key={`${item.created_at}-${index}`}
            className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
              item.role === "assistant"
                ? "bg-white text-slate-800"
                : "ml-auto bg-slate-900 text-white"
            }`}
          >
            <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${item.role === "assistant" ? "text-stone-400" : "text-white/60"}`}>
              {item.role === "assistant" ? "Asistente" : "Abogado"}
            </p>
            <div className="whitespace-pre-wrap">{item.content}</div>
          </article>
        ))}
        {busy && flow.messages.length > 0 ? (
          <p className="text-xs text-stone-400">Pensando…</p>
        ) : null}
      </div>

      {error ? <p className="px-5 py-2 text-sm text-rose-600">{error}</p> : null}

      {!confirmed ? (
        <div className="space-y-3 border-t border-stone-100 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={busy}
                onClick={() => void send(item.text)}
                className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-stone-200 disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim() || busy) return;
              const text = draft.trim();
              setDraft("");
              void send(text);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy}
              placeholder="Complementa hechos, normas o el sentido de la decisión…"
              className="flex-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <button type="submit" disabled={busy} className="theme-btn-primary disabled:opacity-50">
              Enviar
            </button>
          </form>
          {canConfirm ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm(flow.veredicto)}
              className="w-full rounded-full bg-emerald-700 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Confirmar: {veredictoLabel(flow.veredicto)} y pasar al Word
            </button>
          ) : null}
        </div>
      ) : (
        <form
          className="space-y-4 border-t border-emerald-100 bg-emerald-50/70 px-5 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            void generateDraft(event.currentTarget);
          }}
        >
          <div>
            <p className="font-medium text-emerald-950">Veredicto cerrado: {veredictoLabel(flow.veredicto)}</p>
            <p className="mt-1 text-sm text-emerald-800">
              Sube el formato de hoy (plantilla o tutela ya respondida). No usamos uno viejo de biblioteca.
            </p>
          </div>
          <label className="block rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
            <input
              type="file"
              name="template"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              className="hidden"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
            <span className="font-medium text-slate-800">{fileName || "Elegir archivo .docx"}</span>
            <span className="mt-1 block text-xs text-slate-500">Haz clic para seleccionar</span>
          </label>
          <button type="submit" disabled={busy} className="theme-btn-primary w-full disabled:opacity-50">
            {busy ? "Redactando el auto…" : "Descargar borrador Word"}
          </button>
          {downloaded ? (
            <p className="text-center text-sm text-emerald-800">Descarga lista. Revísalo y completa los detalles del despacho.</p>
          ) : null}
        </form>
      )}
    </section>
  );
}
