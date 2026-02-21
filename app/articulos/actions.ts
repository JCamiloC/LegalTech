"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureNonEmpty } from "@/lib/validation/forms";
import { LegalArticlesRepository } from "@/modules/legal";

export async function createLegalArticleAction(formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const repository = new LegalArticlesRepository(supabase);

    const created = await repository.create({
      codigo: ensureNonEmpty(String(formData.get("codigo") ?? ""), "Código requerido"),
      nombre: ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre requerido"),
      descripcion: ensureNonEmpty(String(formData.get("descripcion") ?? ""), "Descripción requerida"),
      aplica_a: ensureNonEmpty(String(formData.get("aplica_a") ?? ""), "Categoría requerida"),
    });

    if (!created) {
      throw new Error("No fue posible crear el artículo");
    }

    revalidatePath("/articulos");
    redirect("/articulos?ok=articulo_creado");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando artículo";
    redirect(`/articulos?error=${encodeURIComponent(message)}`);
  }
}

export async function updateLegalArticleAction(articleId: string, formData: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const repository = new LegalArticlesRepository(supabase);

    const updated = await repository.update(articleId, {
      codigo: ensureNonEmpty(String(formData.get("codigo") ?? ""), "Código requerido"),
      nombre: ensureNonEmpty(String(formData.get("nombre") ?? ""), "Nombre requerido"),
      descripcion: ensureNonEmpty(String(formData.get("descripcion") ?? ""), "Descripción requerida"),
      aplica_a: ensureNonEmpty(String(formData.get("aplica_a") ?? ""), "Categoría requerida"),
    });

    if (!updated) {
      throw new Error("No fue posible actualizar el artículo");
    }

    revalidatePath("/articulos");
    redirect("/articulos?ok=articulo_actualizado");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando artículo";
    redirect(`/articulos?error=${encodeURIComponent(message)}`);
  }
}

export async function deleteLegalArticleAction(articleId: string) {
  const supabase = await createSupabaseServerClient();
  const repository = new LegalArticlesRepository(supabase);

  const deleted = await repository.delete(articleId);

  if (!deleted) {
    redirect("/articulos?error=No%20fue%20posible%20eliminar%20el%20art%C3%ADculo");
  }

  revalidatePath("/articulos");
  redirect("/articulos?ok=articulo_eliminado");
}
