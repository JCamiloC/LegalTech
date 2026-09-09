import mammoth from "mammoth";
import type { CaseRecord } from "@/types";
import { callGemini, isGeminiConfigured } from "./gemini-client";
import { readTutelaFlow, veredictoLabel } from "./tutela-flow";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").trim();
}

export async function draftTutelaWord(params: {
  tutela: CaseRecord;
  templateText: string;
  templateName: string;
}): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini no está configurado.");
  }

  const flow = readTutelaFlow(params.tutela.llm_extraccion_json);
  const veredicto = veredictoLabel(flow.veredicto);

  const prompt = `Redacta el borrador de auto de tutela para un despacho judicial colombiano.

Veredicto consensuado: ${veredicto}
Radicado: ${params.tutela.radicado}
Accionante: ${params.tutela.demandante_nombre}
Accionado(s): ${params.tutela.demandado_nombre}
Despacho: ${params.tutela.despacho ?? "el despacho"}
Hechos: ${params.tutela.hechos_resumen ?? ""}
Pretensiones: ${params.tutela.pretensiones_resumen ?? ""}

Fundamento acordado en el chat:
${flow.fundamento || flow.messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content || ""}

Formato / tutela de referencia (${params.templateName}):
${params.templateText.slice(0, 12000) || "Usa estructura clásica: encabezado, antecedentes, consideraciones, resuelve."}

Reglas:
- Imita el tono y el orden de secciones del formato de referencia.
- Completa hechos, partes y decisión con los datos de ESTA tutela.
- No inventes normas que no estén en el fundamento.
- Incluye al inicio: "BORRADOR PARA REVISIÓN DEL ABOGADO".
- Responde solo el texto del auto, sin markdown.`;

  const text = await callGemini(prompt, { expectJson: false, timeoutMs: 120000 });
  if (!text) {
    throw new Error("No fue posible redactar el borrador.");
  }

  return text.trim();
}
