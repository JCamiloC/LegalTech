"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureNonEmpty } from "@/lib/validation/forms";
import type { DecisionType } from "@/types";
import { TemplateManagementService, TemplateRepository } from "@/modules/documents";

function parseDecisionType(value: string): DecisionType {
  const allowed: DecisionType[] = [
    "auto_admisorio",
    "auto_inadmisorio",
    "mandamiento_pago",
    "auto_rechaza_demanda",
  ];

  if (allowed.includes(value as DecisionType)) {
    return value as DecisionType;
  }

  throw new Error("Tipo de decisión inválido");
}

export async function createTemplateAction(formData: FormData) {
  try {
    const nombre = ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre de plantilla requerido");
    const tipoDecision = parseDecisionType(String(formData.get("tipo_decision") ?? ""));
    const contenidoHtml = ensureNonEmpty(
      String(formData.get("contenido_html") ?? ""),
      "Contenido HTML requerido"
    );

    const supabase = await createSupabaseServerClient();
    const service = new TemplateManagementService(new TemplateRepository(supabase));

    await service.createTemplate({
      nombre,
      tipo_decision: tipoDecision,
      contenido_html: contenidoHtml,
      activo: true,
    });

    revalidatePath("/plantillas");
    redirect("/plantillas?ok=plantilla_creada");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear plantilla";
    redirect(`/plantillas?error=${encodeURIComponent(message)}`);
  }
}

export async function updateTemplateAction(templateId: string, formData: FormData) {
  try {
    const nombre = ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre de plantilla requerido");
    const tipoDecision = parseDecisionType(String(formData.get("tipo_decision") ?? ""));
    const contenidoHtml = ensureNonEmpty(
      String(formData.get("contenido_html") ?? ""),
      "Contenido HTML requerido"
    );
    const activo = String(formData.get("activo") ?? "") === "on";

    const supabase = await createSupabaseServerClient();
    const service = new TemplateManagementService(new TemplateRepository(supabase));

    await service.updateTemplate(templateId, {
      nombre,
      tipo_decision: tipoDecision,
      contenido_html: contenidoHtml,
      activo,
    });

    revalidatePath("/plantillas");
    redirect("/plantillas?ok=plantilla_actualizada");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar plantilla";
    redirect(`/plantillas?error=${encodeURIComponent(message)}`);
  }
}

export async function toggleTemplateAction(templateId: string, currentActive: boolean) {
  const supabase = await createSupabaseServerClient();
  const service = new TemplateManagementService(new TemplateRepository(supabase));
  await service.setTemplateActive(templateId, !currentActive);

  revalidatePath("/plantillas");
  redirect("/plantillas?ok=estado_plantilla_actualizado");
}