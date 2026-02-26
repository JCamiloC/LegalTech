"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureNonEmpty } from "@/lib/validation/forms";
import type { RuleCondition } from "@/types";
import { RuleRepository, RuleService } from "@/modules/rules";

const ALLOWED_RESULTS = [
  "auto_admisorio",
  "auto_inadmisorio",
  "mandamiento_pago",
  "auto_rechaza_demanda",
] as const;

function isAllowedDecisionResult(value: string): value is (typeof ALLOWED_RESULTS)[number] {
  return ALLOWED_RESULTS.includes(value as (typeof ALLOWED_RESULTS)[number]);
}

function parseConditionJson(raw: string): RuleCondition | null {
  try {
    return JSON.parse(raw) as RuleCondition;
  } catch {
    return null;
  }
}

export async function createRuleAction(formData: FormData) {
  const nombre = ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre requerido");
  const descripcion = ensureNonEmpty(String(formData.get("descripcion") ?? ""), "Descripción requerida");
  const condicionRaw = String(formData.get("condicion_json") ?? "").trim();
  const resultado = ensureNonEmpty(String(formData.get("resultado") ?? ""), "Resultado requerido");
  const fundamento = ensureNonEmpty(String(formData.get("fundamento") ?? ""), "Fundamento requerido");
  const prioridad = Number(formData.get("prioridad") ?? 999);

  const condicion = parseConditionJson(condicionRaw);

  if (!nombre || !descripcion || !condicion || !resultado || !fundamento || Number.isNaN(prioridad)) {
    redirect("/reglas?error=Datos%20inv%C3%A1lidos%20para%20crear%20la%20regla");
  }

  if (!isAllowedDecisionResult(resultado)) {
    redirect("/reglas?error=Resultado%20de%20regla%20no%20permitido");
  }

  if (prioridad < 1) {
    redirect("/reglas?error=La%20prioridad%20debe%20ser%20mayor%20o%20igual%20a%201");
  }

  const supabase = await createSupabaseServerClient();
  const service = new RuleService(new RuleRepository(supabase));

  await service.createRule({
    nombre,
    descripcion,
    condicion_json: condicion,
    resultado,
    fundamento,
    prioridad,
    activo: true,
  });

  revalidatePath("/reglas");
  redirect("/reglas?ok=regla_creada");
}

export async function updateRuleAction(ruleId: string, formData: FormData) {
  const nombre = ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre requerido");
  const descripcion = ensureNonEmpty(String(formData.get("descripcion") ?? ""), "Descripción requerida");
  const condicionRaw = String(formData.get("condicion_json") ?? "").trim();
  const resultado = ensureNonEmpty(String(formData.get("resultado") ?? ""), "Resultado requerido");
  const fundamento = ensureNonEmpty(String(formData.get("fundamento") ?? ""), "Fundamento requerido");
  const prioridad = Number(formData.get("prioridad") ?? 999);

  const condicion = parseConditionJson(condicionRaw);

  if (!nombre || !descripcion || !condicion || !resultado || !fundamento || Number.isNaN(prioridad)) {
    redirect("/reglas?error=Datos%20inv%C3%A1lidos%20para%20actualizar%20la%20regla");
  }

  if (!isAllowedDecisionResult(resultado)) {
    redirect("/reglas?error=Resultado%20de%20regla%20no%20permitido");
  }

  if (prioridad < 1) {
    redirect("/reglas?error=La%20prioridad%20debe%20ser%20mayor%20o%20igual%20a%201");
  }

  const supabase = await createSupabaseServerClient();
  const service = new RuleService(new RuleRepository(supabase));

  await service.updateRule(ruleId, {
    nombre,
    descripcion,
    condicion_json: condicion,
    resultado,
    fundamento,
    prioridad,
  });

  revalidatePath("/reglas");
  redirect("/reglas?ok=regla_actualizada");
}

export async function toggleRuleAction(ruleId: string, currentActive: boolean) {
  const supabase = await createSupabaseServerClient();
  const service = new RuleService(new RuleRepository(supabase));

  await service.setRuleActive(ruleId, !currentActive);

  revalidatePath("/reglas");
  redirect("/reglas?ok=estado_regla_actualizado");
}