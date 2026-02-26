import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FeedbackToast from "@/components/FeedbackToast";
import { RuleRepository, RuleService } from "@/modules/rules";
import { createRuleAction, toggleRuleAction, updateRuleAction } from "./actions";

interface ReglasPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function FieldHint({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex cursor-help items-center rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-500">
      ?
    </span>
  );
}

export default async function ReglasPage({ searchParams }: ReglasPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  const supabase = await createSupabaseServerClient();
  const ruleService = new RuleService(new RuleRepository(supabase));
  const rules = await ruleService.listRules();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <FeedbackToast message={okMessage} tone="success" />
      <FeedbackToast message={errorMessage} tone="error" />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gestión de reglas</h1>
          <p className="mt-1 text-sm text-slate-600">Define reglas jurídicas de forma guiada: resultado, prioridad, fundamento y condición lógica.</p>
        </div>
        <Link href="/casos" className="theme-btn-rules">
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
          <p className="mt-1 text-xs">Ajustar condiciones y prioridad.</p>
        </Link>
        <Link href="/plantillas" className="theme-quick-card theme-quick-card-templates">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Plantillas</p>
          <p className="mt-1 text-xs">Editar documentos base.</p>
        </Link>
        <Link href="/articulos" className="theme-quick-card theme-quick-card-legal">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Artículos</p>
          <p className="mt-1 text-xs">Gestionar base normativa.</p>
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Nueva regla</h2>
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <p className="font-semibold">Guía rápida para operador jurídico</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li><strong>Resultado:</strong> define el tipo de auto sugerido cuando la condición se cumple.</li>
            <li><strong>Prioridad:</strong> número más bajo = mayor precedencia si varias reglas coinciden.</li>
            <li><strong>Fundamento jurídico:</strong> texto que respalda la sugerencia que verá el despacho.</li>
            <li><strong>Condición:</strong> lógica de activación de la regla sobre datos del caso/checklist.</li>
          </ul>
        </div>
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Plantillas JSON rápidas</summary>
          <p className="mt-2 text-xs text-slate-500">
            Campos recomendados: <code>cumple_art_82</code>, <code>anexos_completos</code>, <code>competencia_valida</code>, <code>caducidad</code>, <code>prescripcion</code>, <code>tipo_proceso</code>, <code>titulo_ejecutivo_valido</code>, <code>cuantia</code>.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Booleano simple</p>
              <textarea
                readOnly
                className="h-20 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"is_true","field":"caducidad"}'
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Condición OR</p>
              <textarea
                readOnly
                className="h-20 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"or","conditions":[{"op":"is_false","field":"cumple_art_82"},{"op":"is_false","field":"anexos_completos"}]}'
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Condición AND</p>
              <textarea
                readOnly
                className="h-24 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"and","conditions":[{"op":"eq","field":"tipo_proceso","value":"ejecutivo"},{"op":"is_true","field":"titulo_ejecutivo_valido"}]}'
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Comparador numérico</p>
              <textarea
                readOnly
                className="h-24 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"gte","field":"cuantia","value":10000000}'
              />
            </div>
          </div>
        </details>
        <form action={createRuleAction} className="mt-4 grid gap-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-2">Nombre de regla <FieldHint text="Identificación corta y clara para el equipo jurídico." /></span>
            <input name="nombre" placeholder="Ej: Rechazo por caducidad" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-2">Descripción funcional <FieldHint text="Explica en lenguaje simple cuándo aplica la regla." /></span>
            <input
              name="descripcion"
              placeholder="Ej: Si hay caducidad declarada, sugerir auto de rechazo"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-2">Condición de activación (JSON) <FieldHint text="Se evalúa contra datos del caso y checklist. Si se cumple, aplica el resultado." /></span>
            <textarea
              name="condicion_json"
              placeholder='{"op":"is_true","field":"caducidad"}'
              className="h-24 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              required
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="flex items-center gap-2">Resultado <FieldHint text="Tipo de decisión sugerida cuando la regla coincide." /></span>
              <select name="resultado" defaultValue="auto_inadmisorio" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                <option value="auto_admisorio">auto_admisorio</option>
                <option value="auto_inadmisorio">auto_inadmisorio</option>
                <option value="mandamiento_pago">mandamiento_pago</option>
                <option value="auto_rechaza_demanda">auto_rechaza_demanda</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="flex items-center gap-2">Prioridad <FieldHint text="Entre varias reglas coincidentes, se aplica primero la de menor número." /></span>
              <input name="prioridad" type="number" min={1} placeholder="1" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="flex items-center gap-2">Fundamento jurídico <FieldHint text="Texto base que respalda jurídicamente la decisión sugerida." /></span>
              <input name="fundamento" placeholder="Citar motivo jurídico de aplicación" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            </label>
          </div>
          <div>
            <button type="submit" className="theme-btn-primary">
              Crear regla
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Reglas actuales</h2>
        <div className="mt-4 space-y-4">
          {rules.length === 0 ? <p className="text-sm text-slate-600">No hay reglas registradas.</p> : null}

          {rules.map((rule) => {
            const updateAction = updateRuleAction.bind(null, rule.id);
            const switchAction = toggleRuleAction.bind(null, rule.id, rule.activo);

            return (
              <article key={rule.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {rule.nombre} · prioridad {rule.prioridad}
                  </p>
                  <form action={switchAction}>
                    <button type="submit" className="rounded-md border border-slate-300 px-3 py-1 text-xs">
                      {rule.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>

                <form action={updateAction} className="grid gap-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="flex items-center gap-2">Nombre <FieldHint text="Nombre visible para consulta y auditoría interna." /></span>
                    <input name="nombre" defaultValue={rule.nombre} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="flex items-center gap-2">Descripción <FieldHint text="Resumen de la hipótesis jurídica de la regla." /></span>
                    <input
                      name="descripcion"
                      defaultValue={rule.descripcion}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      required
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="flex items-center gap-2">Condición (JSON) <FieldHint text="Estructura lógica evaluada por el motor de reglas." /></span>
                    <textarea
                      name="condicion_json"
                      defaultValue={JSON.stringify(rule.condicion_json)}
                      className="h-20 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
                      required
                    />
                  </label>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="flex items-center gap-2">Resultado <FieldHint text="Tipo de decisión que sugiere la regla." /></span>
                      <select name="resultado" defaultValue={rule.resultado} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required>
                        <option value="auto_admisorio">auto_admisorio</option>
                        <option value="auto_inadmisorio">auto_inadmisorio</option>
                        <option value="mandamiento_pago">mandamiento_pago</option>
                        <option value="auto_rechaza_demanda">auto_rechaza_demanda</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="flex items-center gap-2">Prioridad <FieldHint text="1 es la más fuerte y prevalece sobre números mayores." /></span>
                      <input name="prioridad" type="number" min={1} defaultValue={rule.prioridad} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                    </label>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="flex items-center gap-2">Fundamento <FieldHint text="Argumento jurídico que se mostrará como soporte de la sugerencia." /></span>
                      <input name="fundamento" defaultValue={rule.fundamento} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                    </label>
                  </div>
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