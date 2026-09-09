"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureNonEmpty, toNullableString } from "@/lib/validation/forms";
import { normalizeDecisionType } from "@/modules/documents";
import { KnowledgeRepository } from "@/modules/knowledge";

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function createKnowledgeFolderAction(profileId: string, formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const repository = new KnowledgeRepository(supabase);

    const created = await repository.createFolder({
      profile_id: profileId,
      nombre: ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre de carpeta requerido"),
      descripcion: toNullableString(formData.get("descripcion")),
      orden: Number(formData.get("orden") ?? 100),
    });

    if (!created) {
      throw new Error("No fue posible crear la carpeta");
    }

    revalidatePath("/biblioteca");
    redirect(`/biblioteca?profileId=${profileId}&ok=carpeta_creada`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Error creando carpeta";
    redirect(`/biblioteca?profileId=${profileId}&error=${encodeURIComponent(message)}`);
  }
}

export async function createKnowledgeDocumentAction(profileId: string, formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const repository = new KnowledgeRepository(supabase);

    const folderRaw = String(formData.get("folder_id") ?? "").trim();
    const caseRaw = String(formData.get("case_id") ?? "").trim();

    const created = await repository.createDocument({
      profile_id: profileId,
      folder_id: folderRaw || null,
      case_id: caseRaw || null,
      titulo: ensureNonEmpty(String(formData.get("titulo") ?? ""), "Titulo requerido"),
      tipo_documento: ensureNonEmpty(String(formData.get("tipo_documento") ?? ""), "Tipo de documento requerido"),
      etiquetas: parseTags(String(formData.get("etiquetas") ?? "")),
      contenido_texto: toNullableString(formData.get("contenido_texto")),
      metadata_json: {
        origen: String(formData.get("origen") ?? "manual"),
      },
    });

    if (!created) {
      throw new Error("No fue posible crear el documento de biblioteca");
    }

    revalidatePath("/biblioteca");
    redirect(`/biblioteca?profileId=${profileId}&ok=documento_agregado`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Error agregando documento";
    redirect(`/biblioteca?profileId=${profileId}&error=${encodeURIComponent(message)}`);
  }
}

export async function archiveKnowledgeDocumentAction(profileId: string, documentId: string) {
  const supabase = await createSupabaseServerClient();
  const repository = new KnowledgeRepository(supabase);

  const ok = await repository.archiveDocument(documentId);

  if (!ok) {
    redirect(`/biblioteca?profileId=${profileId}&error=No%20fue%20posible%20archivar%20el%20documento`);
  }

  revalidatePath("/biblioteca");
  redirect(`/biblioteca?profileId=${profileId}&ok=documento_archivado`);
}

export async function createLegalTemplateUploadAction(profileId: string, formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const repository = new KnowledgeRepository(supabase);
    const decisionTypeRaw = String(formData.get("tipo_decision") ?? "general");
    const decisionType = normalizeDecisionType(decisionTypeRaw);
    const templateName = ensureNonEmpty(String(formData.get("nombre_plantilla") ?? ""), "Nombre de plantilla requerido");
    const templateHtml = ensureNonEmpty(
      String(formData.get("contenido_plantilla_html") ?? ""),
      "Contenido de plantilla requerido"
    );

    const created = await repository.createDocument({
      profile_id: profileId,
      folder_id: null,
      case_id: null,
      titulo: templateName,
      tipo_documento: "plantilla_legal",
      etiquetas: parseTags(String(formData.get("etiquetas") ?? "")),
      contenido_texto: templateHtml,
      decision_type_normalized: decisionType.normalized,
      decision_type_alias: decisionType.alias,
      replaceable_fields: [],
      metadata_json: {
        origen: "cargue_plantilla",
        tipo_decision: decisionType.normalized,
        tipo_decision_alias: decisionType.alias,
        strict_generation: true,
        legal_notice:
          "La generación documental debe ser estricta: respetar redacción, puntuación, comas, tildes y estructura legal de la plantilla.",
      },
    });

    if (!created) {
      throw new Error("No fue posible guardar la plantilla legal");
    }

    revalidatePath("/biblioteca");
    redirect(`/biblioteca?profileId=${profileId}&ok=plantilla_legal_cargada`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Error cargando plantilla legal";
    redirect(`/biblioteca?profileId=${profileId}&error=${encodeURIComponent(message)}`);
  }
}
