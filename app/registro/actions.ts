"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureEmail, ensurePassword } from "@/lib/validation/forms";

export async function registerAction(formData: FormData) {
  let email = "";
  let password = "";
  const fullName = String(formData.get("full_name") ?? "").trim();

  try {
    email = ensureEmail(String(formData.get("email") ?? ""));
    password = ensurePassword(String(formData.get("password") ?? ""), 6);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Datos de registro inválidos";
    redirect(`/registro?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || null,
      },
    },
  });

  if (error) {
    redirect(`/registro?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    redirect("/casos");
  }

  redirect("/login?ok=Usuario%20creado.%20Revisa%20tu%20correo%20si%20la%20confirmaci%C3%B3n%20est%C3%A1%20habilitada.");
}