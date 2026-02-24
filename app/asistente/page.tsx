import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { LegalArticlesRepository } from "@/modules/legal";
import { RuleRepository } from "@/modules/rules";
import { ExpertAssistantService } from "@/modules/expert";

interface AsistentePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalize(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AsistentePage({ searchParams }: AsistentePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const question = normalize(resolvedSearchParams.q).trim();
  const caseId = normalize(resolvedSearchParams.caseId).trim();

  const supabase = await createSupabaseServerClient();
  const caseRepository = new CaseRepository(supabase);
  const caseService = new CaseService(caseRepository);
  const legalRepository = new LegalArticlesRepository(supabase);
  const ruleRepository = new RuleRepository(supabase);

  const assistant = new ExpertAssistantService({
    getCaseById: (id) => caseService.getCaseById(id),
    getChecklist: (id) => caseService.getLatestChecklist(id),
    listActiveRules: () => ruleRepository.listActiveRules(),
    listLegalArticles: () => legalRepository.listAll(),
  });

  const response =
    question.length > 0
      ? await assistant.answer({
          question,
          caseId: caseId.length > 0 ? caseId : undefined,
        })
      : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Asistente experto offline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Orientación local basada en reglas y artículos cargados en la app. No usa APIs externas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/casos" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Volver a casos
          </Link>
          <Link href="/reglas" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Ver reglas
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <form method="get" className="grid gap-3">
          <label className="text-sm text-slate-700">
            ID de caso (opcional)
            <input
              name="caseId"
              defaultValue={caseId}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="UUID del caso para orientación contextual"
            />
          </label>
          <label className="text-sm text-slate-700">
            Pregunta
            <textarea
              name="q"
              defaultValue={question}
              required
              className="mt-1 h-24 w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="Ej: ¿Qué debo revisar para un proceso ejecutivo con título?"
            />
          </label>
          <div>
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              Consultar asistente
            </button>
          </div>
        </form>
      </section>

      {response ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Respuesta</h2>
            <p className="mt-1 text-sm text-slate-700">{response.resumen}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recomendaciones</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {response.recomendaciones.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Reglas relevantes</h3>
              {response.reglasRelevantes.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">Sin coincidencias claras.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {response.reglasRelevantes.map((rule) => (
                    <li key={`${rule.nombre}-${rule.prioridad}`} className="rounded-md border border-slate-200 p-2">
                      <p className="font-medium">{rule.nombre}</p>
                      <p>Prioridad: {rule.prioridad}</p>
                      <p>Resultado: {rule.resultado}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Artículos relevantes</h3>
              {response.articulosRelevantes.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">Sin coincidencias claras.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {response.articulosRelevantes.map((article) => (
                    <li key={`${article.codigo}-${article.nombre}`} className="rounded-md border border-slate-200 p-2">
                      <p className="font-medium">{article.codigo}</p>
                      <p>{article.nombre}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Campos sugeridos a revisar</h3>
            {response.camposSugeridos.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No se identifican campos críticos pendientes.</p>
            ) : (
              <p className="mt-2 text-sm text-slate-700">{response.camposSugeridos.join(", ")}</p>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <strong>Siguiente paso sugerido:</strong> {response.siguientePaso}
          </div>
        </section>
      ) : null}
    </main>
  );
}
