"use client";

import { useEffect, useState } from "react";

interface FeedbackToastProps {
  message?: string;
  tone?: "success" | "error";
  durationMs?: number;
}

export default function FeedbackToast({
  message,
  tone = "success",
  durationMs = 4500,
}: FeedbackToastProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
  }, [message]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timeoutId = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timeoutId);
  }, [visible, durationMs]);

  if (!message || !visible) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm">
      <div
        className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
          tone === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-rose-300 bg-rose-50 text-rose-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p>{message}</p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
            aria-label="Cerrar notificación"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}