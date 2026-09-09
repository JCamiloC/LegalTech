"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureNonEmpty } from "@/lib/validation/forms";
import { KnowledgeRepository } from "@/modules/knowledge";

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function parseChecklistItems(raw: string): Array<{ key: string; label: string; required: boolean }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [keyPart, labelPart] = line.split("|").map((part) => part.trim());
      const key = keyPart.replace(/^\*\s*/, "").trim();
      return {
        key,
        label: labelPart || key,
        required: true,
      };
    })
    .filter((item) => item.key.length > 0);
}

function parseCriticalFields(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function createKnowledgeProfileAction(formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const repository = new KnowledgeRepository(supabase);
    const user = await supabase.auth.getUser();
    const profileName = ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre de perfil requerido");

    const created = await repository.createProfile({
      nombre: profileName,
      descripcion: String(formData.get("descripcion") ?? "").trim() || null,
      created_by: user.data.user?.id ?? null,
    });

    if (!created) {
      throw new Error("No fue posible crear el perfil");
    }

    const settingsSaved = await repository.upsertProfileSettings(created.id, {});
    if (!settingsSaved) {
      throw new Error("Perfil creado pero no fue posible inicializar su configuración.");
    }

    revalidatePath("/configuracion");
    revalidatePath("/biblioteca");
    redirect(`/configuracion?ok=perfil_creado&profileId=${created.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Error creando perfil";
    redirect(`/configuracion?error=${encodeURIComponent(message)}`);
  }
}

export async function updateKnowledgeSettingsAction(profileId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const repository = new KnowledgeRepository(supabase);

  const minimumConfidenceRaw = String(formData.get("minimum_confidence") ?? "medio").trim().toLowerCase();
  const minimumConfidence =
    minimumConfidenceRaw === "alto" || minimumConfidenceRaw === "medio" || minimumConfidenceRaw === "bajo"
      ? minimumConfidenceRaw
      : "medio";

  const checklistItems = parseChecklistItems(String(formData.get("checklist_items") ?? ""));
  const criticalFields = parseCriticalFields(String(formData.get("critical_fields") ?? ""));
  const blockOnMissing = String(formData.get("block_on_missing") ?? "").toLowerCase() === "on";

  const ok = await repository.upsertProfileSettings(profileId, {
    checklist_items: checklistItems,
    critical_fields: criticalFields,
    minimum_confidence: minimumConfidence,
    block_on_missing: blockOnMissing,
  });

  if (!ok) {
    redirect(`/configuracion?profileId=${profileId}&error=No%20fue%20posible%20guardar%20la%20configuracion`);
  }

  revalidatePath("/configuracion");
  revalidatePath("/biblioteca");
  redirect(`/configuracion?profileId=${profileId}&ok=configuracion_actualizada`);
}
