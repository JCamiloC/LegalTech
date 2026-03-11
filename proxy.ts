import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PRIVATE_ROUTES = ["/casos", "/documentos", "/reglas", "/plantillas", "/articulos"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: Record<string, unknown>) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: Record<string, unknown>) => {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPrivateRoute = PRIVATE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/casos", request.url));
  }

  if (isPrivateRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
