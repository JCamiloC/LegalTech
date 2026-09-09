interface FlowStepperProps {
  current: 1 | 2 | 3;
}

const STEPS = [
  { id: 1, label: "Contexto", hint: "PDF y datos" },
  { id: 2, label: "Decisión", hint: "Chat y veredicto" },
  { id: 3, label: "Borrador", hint: "Word del despacho" },
] as const;

export default function FlowStepper({ current }: FlowStepperProps) {
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((step, index) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : step.id}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${active || done ? "text-slate-900" : "text-slate-400"}`}>
                {step.label}
              </p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{step.hint}</p>
            </div>
            {index < STEPS.length - 1 ? <div className="hidden h-px flex-1 bg-slate-200 sm:block" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
