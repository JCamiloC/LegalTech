export type TutelaVeredicto =
  | "admitir"
  | "inadmitir"
  | "rechazar"
  | "remitir"
  | "medida_provisional"
  | "pendiente";

export interface TutelaChatMessage {
  role: "user" | "assistant";
  content: string;
  veredicto?: TutelaVeredicto;
  created_at: string;
}

export interface TutelaFlowState {
  messages: TutelaChatMessage[];
  veredicto: TutelaVeredicto;
  veredicto_confirmado: boolean;
  fundamento: string;
}

export const EMPTY_TUTELA_FLOW: TutelaFlowState = {
  messages: [],
  veredicto: "pendiente",
  veredicto_confirmado: false,
  fundamento: "",
};

export function readTutelaFlow(extraction: Record<string, unknown> | null | undefined): TutelaFlowState {
  const raw = extraction?.tutela_flow;
  if (!raw || typeof raw !== "object") {
    return structuredClone(EMPTY_TUTELA_FLOW);
  }

  const source = raw as Partial<TutelaFlowState>;
  const messages = Array.isArray(source.messages)
    ? source.messages.filter(
        (item): item is TutelaChatMessage =>
          Boolean(item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      )
    : [];

  return {
    messages,
    veredicto: isVeredicto(source.veredicto) ? source.veredicto : "pendiente",
    veredicto_confirmado: Boolean(source.veredicto_confirmado),
    fundamento: typeof source.fundamento === "string" ? source.fundamento : "",
  };
}

export function writeTutelaFlow(
  extraction: Record<string, unknown> | null | undefined,
  flow: TutelaFlowState
): Record<string, unknown> {
  return {
    ...(extraction ?? {}),
    tutela_flow: flow,
  };
}

export function isVeredicto(value: unknown): value is TutelaVeredicto {
  return (
    value === "admitir" ||
    value === "inadmitir" ||
    value === "rechazar" ||
    value === "remitir" ||
    value === "medida_provisional" ||
    value === "pendiente"
  );
}

export function veredictoLabel(value: TutelaVeredicto): string {
  switch (value) {
    case "admitir":
      return "Admitir";
    case "inadmitir":
      return "Inadmitir";
    case "rechazar":
      return "Rechazar";
    case "remitir":
      return "Remitir por competencia";
    case "medida_provisional":
      return "Medida provisional";
    default:
      return "Sin definir";
  }
}
