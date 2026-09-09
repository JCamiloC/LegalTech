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
    <div className="min-h-screen bg-[#f6f4ef] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#f6f4ef]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/tutelas" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                T
              </span>
              <span className="text-sm font-semibold tracking-tight">Asistente de tutelas</span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <Link href="/tutelas" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-white hover:text-slate-900">
                Tutelas
              </Link>
              <Link href="/biblioteca" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-white hover:text-slate-900">
                Biblioteca
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {action}
            <form action={logoutAction}>
              <button type="submit" className="rounded-full px-3 py-1.5 text-sm text-slate-500 hover:bg-white hover:text-slate-800">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
