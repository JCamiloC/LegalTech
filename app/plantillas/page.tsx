import Link from "next/link";
import FeedbackToast from "@/components/FeedbackToast";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TemplateManagementService, TemplateRepository } from "@/modules/documents";
import { createTemplateAction, toggleTemplateAction, updateTemplateAction } from "./actions";

interface PlantillasPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const DECISION_TYPES = [
  "auto_admisorio",
  "auto_inadmisorio",
  "mandamiento_pago",
  "auto_rechaza_demanda",
] as const;

export default async function PlantillasPage({ searchParams }: PlantillasPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  const supabase = await createSupabaseServerClient();
  const service = new TemplateManagementService(new TemplateRepository(supabase));
  const templates = await service.listTemplates();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <FeedbackToast message={okMessage} tone="success" />
      <FeedbackToast message={errorMessage} tone="error" />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Plantillas de documento</h1>
          <p className="mt-1 text-sm text-slate-600">Administra plantillas HTML por tipo de decisión.</p>
        </div>
        <Link href="/casos" className="theme-btn-templates">
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
          <p className="mt-1 text-xs">Configurar motor de decisión.</p>
        </Link>
        <Link href="/plantillas" className="theme-quick-card theme-quick-card-templates">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Plantillas</p>
          <p className="mt-1 text-xs">Administrar formatos de autos.</p>
        </Link>
        <Link href="/articulos" className="theme-quick-card theme-quick-card-legal">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Artículos</p>
          <p className="mt-1 text-xs">Gestionar base normativa.</p>
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Nueva plantilla</h2>
        <form action={createTemplateAction} className="mt-4 grid gap-3">
          <input name="nombre" placeholder="Nombre plantilla" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="tipo_decision" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {DECISION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <textarea
            name="contenido_html"
            required
            className="h-40 rounded-lg border border-slate-300 p-2 font-mono text-xs"
            placeholder="<h1>{{despacho}}</h1><p>Radicado: {{radicado}}</p>"
          />
          <div>
            <button type="submit" className="theme-btn-primary">Crear plantilla</button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Plantillas existentes</h2>
        <div className="mt-4 space-y-4">
          {templates.length === 0 ? <p className="text-sm text-slate-600">No hay plantillas registradas.</p> : null}

          {templates.map((template) => {
            const updateAction = updateTemplateAction.bind(null, template.id);
            const toggleAction = toggleTemplateAction.bind(null, template.id, template.activo);

            return (
              <article key={template.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {template.nombre} · {template.tipo_decision}
                  </p>
                  <form action={toggleAction}>
                    <button type="submit" className="rounded-md border border-slate-300 px-3 py-1 text-xs">
                      {template.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>

                <form action={updateAction} className="grid gap-2">
                  <input name="nombre" defaultValue={template.nombre} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                  <select name="tipo_decision" defaultValue={template.tipo_decision} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                    {DECISION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <textarea
                    name="contenido_html"
                    defaultValue={template.contenido_html}
                    className="h-32 rounded-md border border-slate-300 p-2 font-mono text-xs"
                    required
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input name="activo" type="checkbox" defaultChecked={template.activo} />
                    Activa
                  </label>
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