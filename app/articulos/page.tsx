import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FeedbackToast from "@/components/FeedbackToast";
import { LegalArticlesRepository } from "@/modules/legal";
import {
  createLegalArticleAction,
  deleteLegalArticleAction,
  updateLegalArticleAction,
} from "./actions";

interface ArticulosPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function ArticulosPage({ searchParams }: ArticulosPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  const supabase = await createSupabaseServerClient();
  const repository = new LegalArticlesRepository(supabase);
  const articles = await repository.listAll();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <FeedbackToast message={okMessage} tone="success" />
      <FeedbackToast message={errorMessage} tone="error" />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Artículos legales</h1>
          <p className="mt-1 text-sm text-slate-600">Base de artículos normativos para reglas y decisiones.</p>
        </div>
        <Link href="/casos" className="theme-btn-legal">
          Volver a casos
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Link href="/casos/nuevo" className="theme-quick-card theme-quick-card-primary">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Crear caso</p>
          <p className="mt-1 text-xs">Registrar nueva demanda.</p>
        </Link>
        <Link href="/reglas" className="theme-quick-card theme-quick-card-rules">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Reglas</p>
          <p className="mt-1 text-xs">Configurar condiciones jurídicas.</p>
        </Link>
        <Link href="/plantillas" className="theme-quick-card theme-quick-card-templates">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Plantillas</p>
          <p className="mt-1 text-xs">Editar documentos base.</p>
        </Link>
        <Link href="/articulos" className="theme-quick-card theme-quick-card-legal">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Artículos</p>
          <p className="mt-1 text-xs">Administrar normas aplicables.</p>
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Nuevo artículo</h2>
        <form action={createLegalArticleAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              name="codigo"
              placeholder="Código (ej. CGP-82)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              name="nombre"
              placeholder="Nombre"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              name="aplica_a"
              placeholder="Categoría (ej. admision_demanda)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <textarea
            name="descripcion"
            placeholder="Descripción y alcance del artículo"
            className="h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <div>
            <button type="submit" className="theme-btn-primary">
              Crear artículo
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Artículos actuales</h2>
        <div className="mt-4 space-y-4">
          {articles.length === 0 ? <p className="text-sm text-slate-600">No hay artículos registrados.</p> : null}

          {articles.map((article) => {
            const updateAction = updateLegalArticleAction.bind(null, article.id);
            const deleteAction = deleteLegalArticleAction.bind(null, article.id);

            return (
              <article key={article.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{article.codigo}</p>
                  <form action={deleteAction}>
                    <button type="submit" className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700">
                      Eliminar
                    </button>
                  </form>
                </div>
                <form action={updateAction} className="grid gap-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <input name="codigo" defaultValue={article.codigo} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                    <input name="nombre" defaultValue={article.nombre} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                    <input name="aplica_a" defaultValue={article.aplica_a} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                  </div>
                  <textarea
                    name="descripcion"
                    defaultValue={article.descripcion}
                    className="h-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    required
                  />
                  <div>
                    <button type="submit" className="theme-btn-primary px-3 py-1 text-xs">
                      Guardar cambios
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
