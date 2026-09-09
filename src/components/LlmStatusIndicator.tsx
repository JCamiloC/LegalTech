"use client";

import { useEffect, useMemo, useState } from "react";

type LlmStatus = "checking" | "connected" | "disconnected" | "disabled";

interface LlmStatusResponse {
  status?: "connected" | "disconnected" | "disabled";
  model?: string;
  provider?: string;
  latencyMs?: number;
}

function getBadgeClasses(status: LlmStatus): string {
  if (status === "connected") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (status === "disabled") {
    return "border-slate-300 bg-slate-100 text-slate-600";
  }

  if (status === "disconnected") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  return "border-amber-300 bg-amber-50 text-amber-700";
}

function getLabel(status: LlmStatus): string {
  if (status === "connected") return "IA conectada";
  if (status === "disabled") return "IA desactivada";
  if (status === "disconnected") return "IA desconectada";
  return "Verificando IA";
}

export default function LlmStatusIndicator() {
  const [status, setStatus] = useState<LlmStatus>("checking");
  const [model, setModel] = useState<string>("");
  const [provider, setProvider] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch("/api/llm/status", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setStatus("disconnected");
          return;
        }

        const data = (await response.json()) as LlmStatusResponse;
        if (!cancelled) {
          setStatus(data.status ?? "disconnected");
          setModel(data.model ?? "");
          setProvider(data.provider ?? "");
        }
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    }

    check();
    const interval = setInterval(check, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const classes = useMemo(() => getBadgeClasses(status), [status]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-full border border-stone-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur ${classes}`}>
      <span>{getLabel(status)}</span>
      {provider ? <span className="ml-2 opacity-80">{provider}</span> : null}
      {model ? <span className="ml-1 opacity-70">{model}</span> : null}
    </div>
  );
}
