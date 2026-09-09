import type { CaseRecord } from "@/types";
import type { KnowledgeDocumentRecord } from "@/types/knowledge";
import { callGemini, isGeminiConfigured } from "./gemini-client";
import {
  isVeredicto,
  readTutelaFlow,
  type TutelaChatMessage,
  type TutelaFlowState,
  type TutelaVeredicto,
  writeTutelaFlow,
} from "./tutela-flow";

const VERDICT_MARKER = ":::veredicto";

function clip(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n[...texto recortado...]`;
}

function buildLibraryContext(documents: KnowledgeDocumentRecord[]): string {
  if (documents.length === 0) {
    return "No hay documentos en la biblioteca. Fundamenta solo con el Decreto 2591 de 1991 y el artículo 86 de la Constitución, y avisa que falta biblioteca.";
  }

  return documents
    .map((doc, index) => {
      const body = clip(String(doc.contenido_texto ?? doc.resumen_texto ?? ""), 1800);
      return `${index + 1}. ${doc.titulo} (${doc.tipo_documento})\n${body}`;
    })
    .join("\n\n");
}

function buildCaseContext(tutela: CaseRecord): string {
  return [
    `Radicado: ${tutela.radicado}`,
    `Accionante: ${tutela.demandante_nombre}`,
    `Accionado(s): ${tutela.demandado_nombre}`,
    `Despacho: ${tutela.despacho ?? "no indicado"}`,
    `Hechos:\n${tutela.hechos_resumen ?? "no resumidos"}`,
    `Pretensiones:\n${tutela.pretensiones_resumen ?? "no resumidas"}`,
  ].join("\n");
}

function parseAssistantPayload(raw: string): { content: string; veredicto: TutelaVeredicto } {
  const start = raw.lastIndexOf(VERDICT_MARKER);
  if (start < 0) {
    return { content: raw.trim(), veredicto: "pendiente" };
  }

  const after = raw.slice(start + VERDICT_MARKER.length);
  const end = after.indexOf(VERDICT_MARKER);
  const jsonBlock = (end >= 0 ? after.slice(0, end) : after).trim().replace(/^```json|```$/g, "").trim();
  const content = `${raw.slice(0, start).trim()}${end >= 0 ? after.slice(end + VERDICT_MARKER.length) : ""}`.trim();

  try {
    const parsed = JSON.parse(jsonBlock) as { veredicto?: unknown };
    return {
      content: content || raw.trim(),
      veredicto: isVeredicto(parsed.veredicto) ? parsed.veredicto : "pendiente",
    };
  } catch {
    return { content: content || raw.trim(), veredicto: "pendiente" };
  }
}

function buildPrompt(params: {
  tutela: CaseRecord;
  documents: KnowledgeDocumentRecord[];
  history: TutelaChatMessage[];
  userMessage: string | null;
}): string {
  const historyText =
    params.history.length === 0
      ? "(sin mensajes previos)"
      : params.history
          .map((item) => `${item.role === "user" ? "Abogado" : "Asistente"}: ${item.content}`)
          .join("\n\n");

  const task = params.userMessage
    ? `El abogado responde:\n${params.userMessage}\n\nContinúa la conversación. Si cambia el veredicto, explícalo.`
    : `Abre la conversación. Toma la iniciativa: resume la tutela en 4 líneas, evalúa requisitos del Decreto 2591, propone admitir / inadmitir / rechazar / remitir, y cita solo normas de la biblioteca (o 2591 y art. 86 si la biblioteca está vacía).`;

  return `Eres un asistente de apoyo para un despacho judicial colombiano. NO decides: propones. El abogado confirma.

Reglas:
- Español jurídico claro y breve.
- No inventes jurisprudencia ni artículos que no estén en la biblioteca.
- Incluye disclaimer: "Propuesta de apoyo. La decisión es del abogado/juez."
- Al final de tu respuesta, un bloque exacto:
${VERDICT_MARKER}
{"veredicto":"admitir|inadmitir|rechazar|remitir|medida_provisional|pendiente","confianza":"alto|medio|bajo"}
${VERDICT_MARKER}

CONTEXTO DE LA TUTELA
${buildCaseContext(params.tutela)}

BIBLIOTECA NORMATIVA
${buildLibraryContext(params.documents)}

HISTORIAL
${historyText}

TAREA
${task}`;
}

export async function runTutelaChatTurn(params: {
  tutela: CaseRecord;
  documents: KnowledgeDocumentRecord[];
  userMessage?: string | null;
}): Promise<{ flow: TutelaFlowState; error?: string }> {
  const flow = readTutelaFlow(params.tutela.llm_extraccion_json);
  if (flow.veredicto_confirmado) {
    return { flow };
  }

  if (!isGeminiConfigured()) {
    return { flow, error: "Gemini no está configurado. Revisa GEMINI_API_KEY." };
  }

  const userMessage = params.userMessage?.trim() || null;
  if (userMessage) {
    flow.messages.push({
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    });
  }

  const prompt = buildPrompt({
    tutela: params.tutela,
    documents: params.documents,
    history: flow.messages,
    userMessage,
  });

  const raw = await callGemini(prompt, { expectJson: false, timeoutMs: 90000 });
  if (!raw) {
    return { flow, error: "Gemini no respondió. Intenta de nuevo." };
  }

  const parsed = parseAssistantPayload(raw);
  flow.messages.push({
    role: "assistant",
    content: parsed.content,
    veredicto: parsed.veredicto,
    created_at: new Date().toISOString(),
  });
  flow.veredicto = parsed.veredicto;
  flow.fundamento = parsed.content;

  return { flow };
}

export function persistFlow(extraction: Record<string, unknown> | null | undefined, flow: TutelaFlowState) {
  return writeTutelaFlow(extraction, flow);
}
