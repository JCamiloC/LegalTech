import Link from "next/link";
import { registerAction } from "./actions";
import FeedbackToast from "@/components/FeedbackToast";

interface RegistroPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function RegistroPage({ searchParams }: RegistroPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const error = normalizeParam(resolvedParams.error);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <FeedbackToast message={error} tone="error" />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Registro de usuario</h1>
        <p className="mt-2 text-sm text-slate-600">Crea un usuario para ingresar al sistema interno.</p>

        <form action={registerAction} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-700">
            Nombre completo
            <input
              name="full_name"
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre Apellido"
            />
          </label>

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
              minLength={6}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Crear cuenta
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          ¿Ya tienes cuenta? <Link href="/login" className="underline">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}