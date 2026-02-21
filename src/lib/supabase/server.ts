import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: Record<string, unknown>) => {
        (cookieStore as unknown as { set: (cookie: { name: string; value: string } & Record<string, unknown>) => void }).set({
          name,
          value,
          ...options,
        });
      },
      remove: (name: string, options: Record<string, unknown>) => {
        (cookieStore as unknown as { set: (cookie: { name: string; value: string } & Record<string, unknown>) => void }).set({
          name,
          value: "",
          ...options,
        });
      },
    },
  });
};