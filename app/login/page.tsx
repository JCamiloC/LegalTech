import Link from "next/link";
import { loginAction } from "./actions";
import FeedbackToast from "@/components/FeedbackToast";

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorParam = resolvedSearchParams.error;
  const okParam = resolvedSearchParams.ok;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;
  const ok = Array.isArray(okParam) ? okParam[0] : okParam;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <FeedbackToast message={error} tone="error" />
      <FeedbackToast message={ok} tone="success" />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Ingreso al sistema</h1>
        <p className="mt-2 text-sm text-slate-600">
          Plataforma de apoyo para calificación de demandas civiles municipales.
        </p>

        <form action={loginAction} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-700">
            Correo
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="usuario@dominio.com"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Contraseña
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ingresar
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          ¿No tienes cuenta? <Link href="/registro" className="underline">Regístrate</Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          ¿Volver al inicio? <Link href="/" className="underline">Inicio</Link>
        </p>
      </div>
    </main>
  );
}