import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureNonEmpty,
  parsePositiveNumber,
  toNullableString,
} from "@/lib/validation/forms";
import { CaseRepository } from "@/modules/cases";
import { CaseService } from "@/modules/cases/case.service";
import { AuditRepository, AuditService } from "@/modules/audit";
import { KnowledgeRepository } from "@/modules/knowledge";
import { parseCriticalFieldEvaluation } from "@/modules/llm";

export const runtime = "nodejs";

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

function averageConfidence(value: FormDataEntryValue | null): "alto" | "medio" | "bajo" | null {
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

function redirectTo(request: NextRequest, target: string): NextResponse {
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
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

export async function POST(request: NextRequest) {
  let nuevoPath = "/casos/nuevo";

  try {
    const formData = await request.formData();
    const redirectBase = String(formData.get("redirect_base") ?? "").trim();
    if (redirectBase.startsWith("/tutelas")) {
      nuevoPath = "/tutelas/nueva";
    }
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

    const useTutelas = nuevoPath === "/tutelas/nueva";

    revalidatePath(useTutelas ? "/tutelas" : "/casos");
    return redirectTo(
      request,
      useTutelas ? `/tutelas/${newCase.id}?ok=tutela_creada` : `/casos/${newCase.id}?ok=caso_creado`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando caso";
    return redirectTo(request, `${nuevoPath}?error=${encodeURIComponent(message)}`);
  }
}
