"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureNonEmpty,
  parsePositiveNumber,
  toBoolean,
  toNullableString,
} from "@/lib/validation/forms";
import { CaseRepository } from "@/modules/cases";
import { CaseService } from "@/modules/cases/case.service";
import { AuditRepository, AuditService } from "@/modules/audit";
import { DecisionRepository, DecisionService } from "@/modules/decisions";
import { RuleRepository } from "@/modules/rules";
import { LegalArticlesRepository } from "@/modules/legal";
import { KnowledgeRepository } from "@/modules/knowledge";
import {
  LlmDecisionService,
  LlmExtractionService,
  parseCriticalFieldEvaluation,
  type LlmConfidence,
} from "@/modules/llm";
import { evaluateCase } from "@/modules/rules";
import type { DecisionType } from "@/types";

const DECISION_OPTIONS: DecisionType[] = [
  "auto_admisorio",
  "auto_inadmisorio",
  "mandamiento_pago",
  "auto_rechaza_demanda",
];

function assertDecisionType(value: string): DecisionType {
  if (DECISION_OPTIONS.includes(value as DecisionType)) {
    return value as DecisionType;
  }

  return "auto_inadmisorio";
}

function normalizeDocumentText(content: string): string {
  return content.replace(/\r/g, "\n").replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/ +/g, " ");
}

function findFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value.length > 0) {
        return value;
      }
    }
  }

  return null;
}

function parseCuantia(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const numeric = rawValue.replace(/[^\d,\.]/g, "").replace(/\./g, "").replace(/,/g, ".").trim();

  if (!numeric) {
    return null;
  }

  const parsed = Number(numeric);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return String(parsed);
}

function inferTipoProceso(text: string, extracted: string | null): string | null {
  if (extracted) {
    return extracted.trim().toLowerCase();
  }

  const lower = text.toLowerCase();

  if (lower.includes("proceso ejecutivo")) return "ejecutivo";
  if (lower.includes("demanda ejecutiva para la efectividad de la garant") ) return "ejecutivo con garantía real";
  if (lower.includes("proceso verbal")) return "verbal";
  if (lower.includes("proceso monitorio")) return "monitorio";
  if (lower.includes("proceso ordinario")) return "ordinario";

  return null;
}

function normalizeTipoProcesoInput(rawValue: string): string {
  return rawValue.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseJsonObject(value: FormDataEntryValue | null): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function averageConfidence(value: FormDataEntryValue | null): LlmConfidence | null {
  const confidenceMap = parseJsonObject(value);
  if (!confidenceMap) {
    return null;
  }

  const scores: number[] = Object.values(confidenceMap)
    .map((raw) => String(raw).toLowerCase())
    .map((item) => {
      if (item === "alto") return 3;
      if (item === "medio") return 2;
      if (item === "bajo") return 1;
      return 0;
    })
    .filter((score) => score > 0);

  if (scores.length === 0) {
    return null;
  }

  const avg = scores.reduce((total, current) => total + current, 0) / scores.length;
  if (avg >= 2.5) return "alto";
  if (avg >= 1.5) return "medio";
  return "bajo";
}

function normalizeChecklistLabels(
  raw: Array<{ key: string; label: string; required: boolean }> | null | undefined
): Array<{ key: string; label: string }> {
  if (!raw || raw.length === 0) {
    return [];
  }

  return raw
    .map((item) => ({
      key: String(item.key ?? "").trim(),
      label: String(item.label ?? "").trim(),
    }))
    .filter((item) => item.key.length > 0 && item.label.length > 0);
}

function confidenceScore(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "alto") return 3;
  if (normalized === "medio") return 2;
  if (normalized === "bajo") return 1;
  return 0;
}

function hasMeaningfulValue(raw: FormDataEntryValue | null): boolean {
  if (typeof raw !== "string") {
    return false;
  }

  return raw.trim().length > 0;
}

async function extractTextFromPdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (pdfModule.default ?? pdfModule) as (data: Buffer) => Promise<{ text?: string }>;
  const result = await pdfParse(Buffer.from(arrayBuffer));
  return normalizeDocumentText(result.text ?? "");
}

async function extractTextFromPdfFiles(files: File[]): Promise<string> {
  const chunks = await Promise.all(
    files.map(async (file, index) => {
      const text = await extractTextFromPdfFile(file);
      return `\n\n--- DOCUMENTO ${index + 1}: ${file.name} ---\n${text}`;
    })
  );

  return normalizeDocumentText(chunks.join("\n"));
}

function ensurePdfFile(value: FormDataEntryValue | null, errorMessage: string): File {
  if (!(value instanceof File)) {
    throw new Error(errorMessage);
  }

  const isPdf = value.type === "application/pdf" || value.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("Formato no soportado. Use archivos .pdf");
  }

  return value;
}

export async function parseDemandDocumentAction(formData: FormData) {
  let targetPath = "/casos/nuevo";

  try {
    const expedienteEntries = formData.getAll("expediente_files");
    const expedienteFiles = expedienteEntries
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((entry) => ensurePdfFile(entry, "Uno de los archivos del expediente no es válido"));

    // Backward compatibility: if old fields are still posted, keep supporting them.
    const demandaPrincipalRaw = formData.get("demanda_principal");
    const demandaPrincipal =
      demandaPrincipalRaw instanceof File && demandaPrincipalRaw.size > 0
        ? ensurePdfFile(demandaPrincipalRaw, "Debe adjuntar la demanda principal en PDF")
        : null;
    const anexosEntries = formData.getAll("anexos_files");
    const anexosFiles = anexosEntries
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((entry) => ensurePdfFile(entry, "Uno de los anexos no es válido"));

    const allFiles =
      expedienteFiles.length > 0
        ? expedienteFiles
        : [demandaPrincipal, ...anexosFiles].filter((file): file is File => Boolean(file));

    if (allFiles.length === 0) {
      throw new Error("Debe adjuntar al menos un PDF del expediente");
    }

    const text = await extractTextFromPdfFiles(allFiles);

    if (!text.trim() || text.trim().length < 80) {
      throw new Error(
        "No se pudo extraer texto suficiente del expediente para prellenar el caso. Verifica que los PDFs tengan texto legible."
      );
    }

    const query = new URLSearchParams();
    query.set("ok", "expediente_importado");

    const llmExtraction = await new LlmExtractionService().extractFromText(text);

    if (llmExtraction) {
      const llmFields = new LlmExtractionService().extractionToFormFields(llmExtraction);
      for (const [key, value] of Object.entries(llmFields)) {
        if (value && value.trim().length > 0) {
          query.set(key, value);
        }
      }

      targetPath = `/casos/nuevo?${query.toString()}`;
      redirect(targetPath);
    }

    const radicado = findFirstMatch(text, [
      /radicado\s*(?:no\.?|n\.?|número|num\.?|#)?\s*[:\-]?\s*([A-Z0-9\-\.\/]{6,})/i,
      /referencia\s*[:\-]\s*([A-Z0-9\-\.\/]{6,})/i,
    ]);

    const demandante = findFirstMatch(text, [
      /dte\s*[:\-]\s*([^\n]{3,140})/i,
      /demandante(?:s)?\s*[:\-]\s*([^\n]{3,120})/i,
      /actor(?:a)?\s*[:\-]\s*([^\n]{3,120})/i,
    ]);

    const demandado = findFirstMatch(text, [
      /ddo\s*[:\-]\s*([^\n]{3,140})/i,
      /demandado(?:s)?\s*[:\-]\s*([^\n]{3,120})/i,
      /convocado(?:s)?\s*[:\-]\s*([^\n]{3,120})/i,
    ]);

    const tipoProcesoRaw = findFirstMatch(text, [
      /ref\s*[:\-]\s*([^\n]{3,180})/i,
      /tipo\s+de\s+proceso\s*[:\-]\s*([^\n]{3,100})/i,
      /proceso\s*[:\-]\s*([^\n]{3,100})/i,
    ]);

    const subtipoProceso = findFirstMatch(text, [/subtipo\s+de\s+proceso\s*[:\-]\s*([^\n]{3,100})/i]);
    const cuantiaRaw = findFirstMatch(text, [
      /cuant[ií]a\s*[:\-]?\s*\$?\s*([^\n]{1,40})/i,
      /pretensiones\s*[:\-]?\s*\$?\s*([^\n]{1,40})/i,
    ]);
    const competencia = findFirstMatch(text, [
      /competencia\s+territorial\s*[:\-]\s*([^\n]{3,120})/i,
      /competencia\s*[:\-]\s*([^\n]{3,120})/i,
    ]);
    const despacho = findFirstMatch(text, [
      /juzgado\s*[:\-]\s*([^\n]{3,160})/i,
      /despacho\s*[:\-]\s*([^\n]{3,160})/i,
    ]);

    if (radicado) query.set("radicado", radicado);
    if (demandante) query.set("demandante_nombre", demandante);
    if (demandado) query.set("demandado_nombre", demandado);

    const tipoProceso = inferTipoProceso(text, tipoProcesoRaw);
    if (tipoProceso) query.set("tipo_proceso", tipoProceso);
    if (subtipoProceso) query.set("subtipo_proceso", subtipoProceso);

    const cuantia = parseCuantia(cuantiaRaw);
    if (cuantia) query.set("cuantia", cuantia);
    if (competencia) query.set("competencia_territorial", competencia);
    if (despacho) query.set("despacho", despacho);

    targetPath = `/casos/nuevo?${query.toString()}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible importar el documento";
    targetPath = `/casos/nuevo?error=${encodeURIComponent(message)}`;
  }

  redirect(targetPath);
}

export async function createCaseAction(formData: FormData) {
  let targetPath = "/casos/nuevo";

  try {
    const profileId = toNullableString(formData.get("profile_id"));
    const criticalEvaluation = parseCriticalFieldEvaluation(parseJsonObject(formData.get("critical_eval_json")));

    if (criticalEvaluation?.blocking_mode === "block" && !criticalEvaluation.is_ready_for_submission) {
      const missingCritical = criticalEvaluation.issues
        .filter((item) => item.blocking)
        .map((item) => item.field)
        .join(", ");
      throw new Error(`Campos críticos pendientes: ${missingCritical}. Corrige antes de crear el caso.`);
    }

    const supabase = await createSupabaseServerClient();
    if (profileId) {
      const settings = await new KnowledgeRepository(supabase).getProfileSettings(profileId);
      if (settings?.block_on_missing) {
        const confidenceMap = parseJsonObject(formData.get("llm_confianza_json")) ?? {};
        const minScore = confidenceScore(settings.minimum_confidence);
        const failedFields = settings.critical_fields.filter((field) => {
          if (!hasMeaningfulValue(formData.get(field))) {
            return true;
          }

          const score = confidenceScore(String(confidenceMap[field] ?? ""));
          if (score === 0) {
            return false;
          }

          return score < minScore;
        });

        if (failedFields.length > 0) {
          throw new Error(`Campos críticos pendientes según perfil: ${failedFields.join(", ")}.`);
        }
      }
    }

    const caseService = new CaseService(new CaseRepository(supabase));
    const auditService = new AuditService(new AuditRepository(supabase));

    const newCase = await caseService.createCase({
      profile_id: profileId,
      radicado: ensureNonEmpty(String(formData.get("radicado") ?? ""), "Radicado requerido"),
      demandante_nombre: ensureNonEmpty(
        String(formData.get("demandante_nombre") ?? ""),
        "Demandante requerido"
      ),
      demandado_nombre: ensureNonEmpty(String(formData.get("demandado_nombre") ?? ""), "Demandado requerido"),
      tipo_proceso: normalizeTipoProcesoInput(
        ensureNonEmpty(String(formData.get("tipo_proceso") ?? ""), "Tipo de proceso requerido")
      ),
      subtipo_proceso: toNullableString(formData.get("subtipo_proceso")),
      cuantia: parsePositiveNumber(formData.get("cuantia")),
      competencia_territorial: toNullableString(formData.get("competencia_territorial")),
      despacho: toNullableString(formData.get("despacho")),
      pretensiones_resumen: toNullableString(formData.get("pretensiones_resumen")),
      hechos_resumen: toNullableString(formData.get("hechos_resumen")),
      fecha_demanda: toNullableString(formData.get("fecha_demanda")),
      llm_extraccion_json: parseJsonObject(formData.get("llm_extraccion_json")),
      llm_confianza_promedio: averageConfidence(formData.get("llm_confianza_json")),
    });

    if (!newCase) {
      throw new Error("No fue posible crear el caso");
    }

    await auditService.logCaseEvent(newCase.id, "case_created", {
      radicado: newCase.radicado,
      tipo_proceso: newCase.tipo_proceso,
    });

    const checklistPrefilled = parseJsonObject(formData.get("checklist_json"));
    if (checklistPrefilled) {
      await caseService.saveChecklist(newCase.id, {
        cumple_art_82: Boolean(checklistPrefilled.cumple_art_82 && (checklistPrefilled.cumple_art_82 as { valor?: unknown }).valor),
        anexos_completos: Boolean(checklistPrefilled.anexos_completos && (checklistPrefilled.anexos_completos as { valor?: unknown }).valor),
        poder_aportado: Boolean(checklistPrefilled.poder_aportado && (checklistPrefilled.poder_aportado as { valor?: unknown }).valor),
        legitimacion_causa: Boolean(checklistPrefilled.legitimacion_causa && (checklistPrefilled.legitimacion_causa as { valor?: unknown }).valor),
        competencia_valida: Boolean(checklistPrefilled.competencia_valida && (checklistPrefilled.competencia_valida as { valor?: unknown }).valor),
        titulo_ejecutivo_valido: Boolean(checklistPrefilled.titulo_ejecutivo_valido && (checklistPrefilled.titulo_ejecutivo_valido as { valor?: unknown }).valor),
        indebida_acumulacion: Boolean(checklistPrefilled.indebida_acumulacion && (checklistPrefilled.indebida_acumulacion as { valor?: unknown }).valor),
        caducidad: Boolean(checklistPrefilled.caducidad && (checklistPrefilled.caducidad as { valor?: unknown }).valor),
        prescripcion: Boolean(checklistPrefilled.prescripcion && (checklistPrefilled.prescripcion as { valor?: unknown }).valor),
        observaciones: [
          (checklistPrefilled.cumple_art_82 as { razon?: unknown })?.razon,
          (checklistPrefilled.anexos_completos as { razon?: unknown })?.razon,
          (checklistPrefilled.poder_aportado as { razon?: unknown })?.razon,
          (checklistPrefilled.legitimacion_causa as { razon?: unknown })?.razon,
          (checklistPrefilled.competencia_valida as { razon?: unknown })?.razon,
          (checklistPrefilled.titulo_ejecutivo_valido as { razon?: unknown })?.razon,
          (checklistPrefilled.indebida_acumulacion as { razon?: unknown })?.razon,
          (checklistPrefilled.caducidad as { razon?: unknown })?.razon,
          (checklistPrefilled.prescripcion as { razon?: unknown })?.razon,
        ]
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .join("\n"),
      });
    }

    revalidatePath("/casos");
    targetPath = `/casos/${newCase.id}?ok=caso_creado`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando caso";
    targetPath = `/casos/nuevo?error=${encodeURIComponent(message)}`;
  }

  redirect(targetPath);
}

export async function updateCaseAction(caseId: string, formData: FormData) {
  let targetPath = `/casos/${caseId}`;

  try {
    const supabase = await createSupabaseServerClient();
    const caseService = new CaseService(new CaseRepository(supabase));
    const auditService = new AuditService(new AuditRepository(supabase));

    const updated = await caseService.updateCase(caseId, {
      radicado: ensureNonEmpty(String(formData.get("radicado") ?? ""), "Radicado requerido"),
      demandante_nombre: ensureNonEmpty(
        String(formData.get("demandante_nombre") ?? ""),
        "Demandante requerido"
      ),
      demandado_nombre: ensureNonEmpty(String(formData.get("demandado_nombre") ?? ""), "Demandado requerido"),
      tipo_proceso: normalizeTipoProcesoInput(
        ensureNonEmpty(String(formData.get("tipo_proceso") ?? ""), "Tipo de proceso requerido")
      ),
      subtipo_proceso: toNullableString(formData.get("subtipo_proceso")),
      cuantia: parsePositiveNumber(formData.get("cuantia")),
      competencia_territorial: toNullableString(formData.get("competencia_territorial")),
      despacho: toNullableString(formData.get("despacho")),
      pretensiones_resumen: toNullableString(formData.get("pretensiones_resumen")),
      hechos_resumen: toNullableString(formData.get("hechos_resumen")),
      fecha_demanda: toNullableString(formData.get("fecha_demanda")),
    });

    if (!updated) {
      throw new Error("No fue posible actualizar el caso");
    }

    await auditService.logCaseEvent(caseId, "case_updated", {
      radicado: updated.radicado,
    });

    revalidatePath(`/casos/${caseId}`);
    targetPath = `/casos/${caseId}?ok=caso_actualizado`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando caso";
    targetPath = `/casos/${caseId}?error=${encodeURIComponent(message)}`;
  }

  redirect(targetPath);
}

export async function deleteCaseAction(caseId: string) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));
  const caseRecord = await caseService.getCaseById(caseId);

  if (!caseRecord) {
    redirect(`/casos?error=Caso%20no%20encontrado`);
  }

  await auditService.logCaseEvent(caseId, "case_deleted", {
    radicado: caseRecord.radicado,
  });

  const deleted = await caseService.deleteCase(caseId);

  if (!deleted) {
    redirect(`/casos/${caseId}?error=No%20fue%20posible%20eliminar%20el%20caso`);
  }

  revalidatePath("/casos");
  redirect(`/casos?ok=caso_eliminado`);
}

export async function saveChecklistAction(caseId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));

  const checklist = await caseService.saveChecklist(caseId, {
    cumple_art_82: toBoolean(formData.get("cumple_art_82")),
    anexos_completos: toBoolean(formData.get("anexos_completos")),
    poder_aportado: toBoolean(formData.get("poder_aportado")),
    legitimacion_causa: toBoolean(formData.get("legitimacion_causa")),
    competencia_valida: toBoolean(formData.get("competencia_valida")),
    titulo_ejecutivo_valido: toBoolean(formData.get("titulo_ejecutivo_valido")),
    indebida_acumulacion: toBoolean(formData.get("indebida_acumulacion")),
    caducidad: toBoolean(formData.get("caducidad")),
    prescripcion: toBoolean(formData.get("prescripcion")),
    observaciones: toNullableString(formData.get("observaciones")),
  });

  if (!checklist) {
    redirect(`/casos/${caseId}?error=No%20fue%20posible%20guardar%20checklist`);
  }

  await auditService.logCaseEvent(caseId, "checklist_saved", {
    cumple_art_82: checklist.cumple_art_82,
    anexos_completos: checklist.anexos_completos,
  });

  revalidatePath(`/casos/${caseId}`);
  redirect(`/casos/${caseId}?ok=checklist_guardado`);
}

export async function evaluateCaseAction(caseId: string) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const decisionService = new DecisionService(new DecisionRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));

  const [caseRecord, checklist] = await Promise.all([
    caseService.getCaseById(caseId),
    caseService.getLatestChecklist(caseId),
  ]);

  if (!caseRecord) {
    redirect(`/casos/${caseId}?error=Caso%20no%20encontrado`);
  }

  if (!checklist) {
    redirect(`/casos/${caseId}?error=Primero%20debes%20guardar%20el%20checklist`);
  }

  if (caseRecord.estado !== "pendiente") {
    redirect(`/casos/${caseId}?error=La%20evaluaci%C3%B3n%20solo%20est%C3%A1%20disponible%20en%20estado%20pendiente`);
  }

  let checklistLabels: Array<{ key: string; label: string }> = [];
  if (caseRecord.profile_id) {
    const knowledgeRepository = new KnowledgeRepository(supabase);
    const profileSettings = await knowledgeRepository.getProfileSettings(caseRecord.profile_id);
    checklistLabels = normalizeChecklistLabels(profileSettings?.checklist_items);
  }

  const suggestion = await evaluateCase(caseId, supabase, { checklistLabels });

  await caseService.setSuggestedDecision(caseId, suggestion.tipoDecision);
  await auditService.logCaseEvent(caseId, "rules_evaluated", {
    tipo_decision: suggestion.tipoDecision,
  });

  const existingDecision = await decisionService.getLatestByCaseId(caseId);

  if (!existingDecision) {
    await decisionService.saveDecision({
      case_id: caseId,
      tipo_decision: suggestion.tipoDecision,
      fundamento_juridico: suggestion.fundamento,
      motivacion: suggestion.explicacion.argumentoEstandar,
      articulos_aplicados: "Por completar por operador jurídico",
      fecha_generacion: new Date().toISOString(),
      documento_url: null,
    });
  }

  revalidatePath(`/casos/${caseId}`);
  redirect(`/casos/${caseId}?ok=reglas_evaluadas`);
}

export async function saveDecisionAction(caseId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const decisionService = new DecisionService(new DecisionRepository(supabase));
  const caseService = new CaseService(new CaseRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));
  const caseRecord = await caseService.getCaseById(caseId);

  if (!caseRecord) {
    redirect(`/casos/${caseId}?error=Caso%20no%20encontrado`);
  }

  if (caseRecord.estado !== "en_revision") {
    redirect(`/casos/${caseId}?error=Solo%20puedes%20guardar%20decisi%C3%B3n%20final%20en%20estado%20en_revision`);
  }

  const tipoDecision = assertDecisionType(String(formData.get("tipo_decision") ?? ""));
  const fundamento = String(formData.get("fundamento_juridico") ?? "").trim();
  const motivacion = String(formData.get("motivacion") ?? "").trim();
  const articulosAplicados = String(formData.get("articulos_aplicados") ?? "").trim();
  const parteMotivaBorrador = toNullableString(formData.get("parte_motiva_borrador"));

  const latestDecision = await decisionService.getLatestByCaseId(caseId);

  if (latestDecision) {
    await decisionService.updateDecision(latestDecision.id, {
      tipo_decision: tipoDecision,
      fundamento_juridico: fundamento || latestDecision.fundamento_juridico,
      motivacion: motivacion || latestDecision.motivacion,
      articulos_aplicados: articulosAplicados || latestDecision.articulos_aplicados,
    });
  } else {
    await decisionService.saveDecision({
      case_id: caseId,
      tipo_decision: tipoDecision,
      fundamento_juridico: fundamento || "Fundamento pendiente de completar",
      motivacion: motivacion || "Motivación pendiente de completar",
      articulos_aplicados: articulosAplicados || "Artículos pendientes de completar",
      fecha_generacion: new Date().toISOString(),
      documento_url: null,
    });
  }

  await caseService.setFinalDecision(caseId, tipoDecision);

  if (parteMotivaBorrador) {
    await supabase.from("cases").update({ parte_motiva_borrador: parteMotivaBorrador }).eq("id", caseId);
  }

  const latestAiSuggestion = await supabase
    .from("case_ai_suggestions")
    .select("id,decision_sugerida")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestAiSuggestion.data) {
    await supabase
      .from("case_ai_suggestions")
      .update({
        fue_correcta: latestAiSuggestion.data.decision_sugerida === tipoDecision,
        decision_final_real: tipoDecision,
      })
      .eq("id", latestAiSuggestion.data.id);
  }

  await auditService.logCaseEvent(caseId, "final_decision_saved", {
    tipo_decision: tipoDecision,
  });

  revalidatePath(`/casos/${caseId}`);
  redirect(`/casos/${caseId}?ok=decision_guardada`);
}

export async function generateDecisionDocumentAction(caseId: string) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const decisionService = new DecisionService(new DecisionRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));

  const [caseRecord, decision] = await Promise.all([
    caseService.getCaseById(caseId),
    decisionService.getLatestByCaseId(caseId),
  ]);

  if (!caseRecord || !decision) {
    redirect(`/casos/${caseId}?error=No%20hay%20informaci%C3%B3n%20suficiente%20para%20generar%20documento`);
  }

  if (caseRecord.estado !== "decidido") {
    redirect(`/casos/${caseId}?error=Primero%20debes%20guardar%20la%20decisi%C3%B3n%20final`);
  }

  await auditService.logCaseEvent(caseId, "document_generated", {
    generation_mode: "docx_download",
    storage: "disabled",
  });

  redirect(`/documentos/descargar?caseId=${caseId}&source=word`);
}

export async function generateCorrectionReportAction(caseId: string) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));

  const caseRecord = await caseService.getCaseById(caseId);

  if (!caseRecord) {
    redirect(`/casos/${caseId}?error=Caso%20no%20encontrado`);
  }

  if (caseRecord.estado === "pendiente") {
    redirect(`/casos/${caseId}?error=Primero%20debes%20evaluar%20el%20caso%20con%20reglas%20o%20IA`);
  }

  await auditService.logCaseEvent(caseId, "correction_report_generated", {
    generation_mode: "docx_download",
  });

  redirect(`/documentos/descargar?caseId=${caseId}&source=word&kind=acta_correcciones`);
}

export async function suggestDecisionAction(caseId: string) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const auditService = new AuditService(new AuditRepository(supabase));

  const [caseRecord, checklist] = await Promise.all([
    caseService.getCaseById(caseId),
    caseService.getLatestChecklist(caseId),
  ]);

  if (!caseRecord) {
    redirect(`/casos/${caseId}?error=Caso%20no%20encontrado`);
  }

  if (!checklist) {
    redirect(`/casos/${caseId}?error=Primero%20debes%20guardar%20el%20checklist`);
  }

  const llmDecisionService = new LlmDecisionService();
  const suggestion = await llmDecisionService.suggestDecision({
    caseRecord,
    checklist,
    supabase,
  });

  if (!suggestion) {
    redirect(`/casos/${caseId}?error=No%20fue%20posible%20obtener%20sugerencia%20IA`);
  }

  await supabase
    .from("cases")
    .update({
      decision_sugerida: suggestion.decision_sugerida,
      parte_motiva_borrador: suggestion.parte_motiva_borrador || null,
      estado: caseRecord.estado === "decidido" ? "decidido" : "en_revision",
    })
    .eq("id", caseId);

  await supabase.from("case_ai_suggestions").insert({
    case_id: caseId,
    decision_sugerida: suggestion.decision_sugerida,
    confianza: suggestion.confianza,
    fundamento_json: suggestion.fundamento_normativo,
    analisis_checklist: suggestion.analisis_checklist,
    parte_motiva_borrador: suggestion.parte_motiva_borrador,
    defectos_json: suggestion.defectos_identificados,
    casos_similares_usados: suggestion.casos_similares_usados,
    biblioteca_contexto_json: suggestion.biblioteca_contexto_usado,
  });

  const ruleRepository = new RuleRepository(supabase);
  const legalRepository = new LegalArticlesRepository(supabase);
  const [activeRules, legalArticles] = await Promise.all([
    ruleRepository.listActiveRules(),
    legalRepository.listAll(),
  ]);

  await auditService.logCaseEvent(caseId, "ai_decision_suggested", {
    decision_sugerida: suggestion.decision_sugerida,
    confianza: suggestion.confianza,
    reglas_activas: activeRules.length,
    articulos_catalogo: legalArticles.length,
    documentos_biblioteca_usados: suggestion.biblioteca_contexto_usado.length,
  });

  revalidatePath(`/casos/${caseId}`);
  redirect(`/casos/${caseId}?ok=decision_sugerida`);
}
