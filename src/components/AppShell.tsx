import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "../../app/login/actions";

interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function AppShell({ children, title, subtitle, action }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/tutelas" className="text-lg font-semibold text-slate-900">
              Tutelas
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/tutelas"
                className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Mis tutelas
              </Link>
              <Link
                href="/biblioteca"
                className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Biblioteca
              </Link>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {action}
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
