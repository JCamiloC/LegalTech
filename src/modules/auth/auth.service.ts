import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "operador_juridico" | "revisor";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export class AuthService {
  constructor(private readonly supabase: SupabaseClient) {}

  signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  async getCurrentUserProfile(): Promise<ProfileRecord | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await this.supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as ProfileRecord;
  }
}