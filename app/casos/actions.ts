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
import {
  createDocxBufferFromTemplate,
  getSignedDecisionDocumentUrl,
  TemplateRepository,
  uploadDecisionDocument,
} from "@/modules/documents";
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

function getDefaultTemplate() {
  return `
    <h1>{{despacho}}</h1>
    <p><strong>Radicado:</strong> {{radicado}}</p>
    <p><strong>Demandante:</strong> {{demandante}}</p>
    <p><strong>Demandado:</strong> {{demandado}}</p>
    <p><strong>Decisión:</strong> {{decision}}</p>
    <p><strong>Fundamento:</strong> {{fundamento}}</p>
  `;
}

export async function createCaseAction(formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const caseService = new CaseService(new CaseRepository(supabase));
    const auditService = new AuditService(new AuditRepository(supabase));

    const newCase = await caseService.createCase({
      radicado: ensureNonEmpty(String(formData.get("radicado") ?? ""), "Radicado requerido"),
      demandante_nombre: ensureNonEmpty(
        String(formData.get("demandante_nombre") ?? ""),
        "Demandante requerido"
      ),
      demandado_nombre: ensureNonEmpty(String(formData.get("demandado_nombre") ?? ""), "Demandado requerido"),
      tipo_proceso: ensureNonEmpty(String(formData.get("tipo_proceso") ?? ""), "Tipo de proceso requerido"),
      subtipo_proceso: toNullableString(formData.get("subtipo_proceso")),
      cuantia: parsePositiveNumber(formData.get("cuantia")),
      competencia_territorial: toNullableString(formData.get("competencia_territorial")),
      despacho: toNullableString(formData.get("despacho")),
    });

    if (!newCase) {
      throw new Error("No fue posible crear el caso");
    }

    await auditService.logCaseEvent(newCase.id, "case_created", {
      radicado: newCase.radicado,
      tipo_proceso: newCase.tipo_proceso,
    });

    revalidatePath("/casos");
    redirect(`/casos/${newCase.id}?ok=caso_creado`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando caso";
    redirect(`/casos/nuevo?error=${encodeURIComponent(message)}`);
  }
}

export async function updateCaseAction(caseId: string, formData: FormData) {
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
      tipo_proceso: ensureNonEmpty(String(formData.get("tipo_proceso") ?? ""), "Tipo de proceso requerido"),
      subtipo_proceso: toNullableString(formData.get("subtipo_proceso")),
      cuantia: parsePositiveNumber(formData.get("cuantia")),
      competencia_territorial: toNullableString(formData.get("competencia_territorial")),
      despacho: toNullableString(formData.get("despacho")),
    });

    if (!updated) {
      throw new Error("No fue posible actualizar el caso");
    }

    await auditService.logCaseEvent(caseId, "case_updated", {
      radicado: updated.radicado,
    });

    revalidatePath(`/casos/${caseId}`);
    redirect(`/casos/${caseId}?ok=caso_actualizado`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando caso";
    redirect(`/casos/${caseId}?error=${encodeURIComponent(message)}`);
  }
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

  const suggestion = await evaluateCase(caseId, supabase);

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
      motivacion: suggestion.explicacion.resumen,
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
  const templateRepository = new TemplateRepository(supabase);
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

  const template = await templateRepository.findActiveByDecision(decision.tipo_decision);
  const templateContent = template?.contenido_html ?? getDefaultTemplate();
  const docxBuffer = await createDocxBufferFromTemplate(templateContent, {
    radicado: caseRecord.radicado,
    despacho: caseRecord.despacho ?? "Despacho por definir",
    demandante: caseRecord.demandante_nombre,
    demandado: caseRecord.demandado_nombre,
    fundamento: decision.fundamento_juridico,
    decision: decision.tipo_decision,
  });

  const objectPath = await uploadDecisionDocument({
    caseId,
    decisionId: decision.id,
    fileName: `decision-${decision.id}.docx`,
    content: docxBuffer,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  if (!objectPath) {
    redirect(`/casos/${caseId}?error=No%20fue%20posible%20subir%20el%20documento`);
  }

  await decisionService.attachDocument(decision.id, objectPath);
  await auditService.logCaseEvent(caseId, "document_generated", {
    document_path: objectPath,
  });
  revalidatePath(`/casos/${caseId}`);
  redirect(`/casos/${caseId}?ok=documento_generado`);
}

export async function openGeneratedDocumentAction(caseId: string) {
  const supabase = await createSupabaseServerClient();
  const decisionService = new DecisionService(new DecisionRepository(supabase));
  const decision = await decisionService.getLatestByCaseId(caseId);

  if (!decision?.documento_url) {
    redirect(`/casos/${caseId}?error=No%20hay%20documento%20generado`);
  }

  const signedUrl = await getSignedDecisionDocumentUrl(decision.documento_url);

  if (!signedUrl) {
    redirect(`/casos/${caseId}?error=No%20fue%20posible%20abrir%20documento`);
  }

  redirect(signedUrl);
}
