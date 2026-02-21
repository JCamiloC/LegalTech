"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureEmail, ensureNonEmpty } from "@/lib/validation/forms";
import { AuthService } from "@/modules/auth";

export async function loginAction(formData: FormData) {
  let email = "";
  let password = "";

  try {
    email = ensureEmail(String(formData.get("email") ?? ""));
    password = ensureNonEmpty(String(formData.get("password") ?? ""), "Credenciales incompletas");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credenciales incompletas";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createSupabaseServerClient();
  const authService = new AuthService(supabase);
  const { error } = await authService.signIn(email, password);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/casos");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  const authService = new AuthService(supabase);
  await authService.signOut();
  redirect("/login");
}