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
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] px-6 py-12">
      <FeedbackToast message={error} tone="error" />
      <FeedbackToast message={ok} tone="success" />
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
          T
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Asistente de tutelas</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Carga el expediente, decide con apoyo y baja el borrador en el formato del despacho.
        </p>
        <form action={loginAction} className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Correo
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="abogado@despacho.gov.co"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Contraseña
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <button type="submit" className="theme-btn-primary w-full">
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
