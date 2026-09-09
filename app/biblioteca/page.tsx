import Link from "next/link";
import FeedbackToast from "@/components/FeedbackToast";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KnowledgeRepository } from "@/modules/knowledge";
import {
  archiveKnowledgeDocumentAction,
  createLegalTemplateUploadAction,
  createKnowledgeDocumentAction,
  createKnowledgeFolderAction,
} from "./actions";

interface BibliotecaPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function BibliotecaPage({ searchParams }: BibliotecaPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const requestedProfileId = normalizeMessage(resolvedSearchParams.profileId);

  const supabase = await createSupabaseServerClient();
  const repository = new KnowledgeRepository(supabase);
  const profiles = await repository.listProfiles();

  const selectedProfile =
    profiles.find((item) => item.id === requestedProfileId) ??
    (profiles.length > 0 ? profiles[0] : null);

  const [folders, documents, cases] = selectedProfile
    ? await Promise.all([
        repository.listFoldersByProfile(selectedProfile.id),
        repository.listDocumentsByProfile(selectedProfile.id),
        supabase.from("cases").select("id,radicado").order("created_at", { ascending: false }).limit(50),
      ])
    : [[], [], { data: [] as Array<{ id: string; radicado: string }> }];

  const docsByFolder = new Map<string, typeof documents>();
  for (const doc of documents) {
    const key = doc.folder_id ?? "sin-carpeta";
    const prev = docsByFolder.get(key) ?? [];
    prev.push(doc);
    docsByFolder.set(key, prev);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <FeedbackToast message={okMessage} tone="success" />
      <FeedbackToast message={errorMessage} tone="error" />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Biblioteca normativa</h1>
          <p className="mt-1 text-sm text-slate-600">
            Decreto 2591, Constitución, códigos y jurisprudencia que el asistente usa para fundamentar decisiones.
          </p>
        </div>
        <Link href="/tutelas" className="theme-btn-legal">
          Volver a tutelas
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Perfil activo</h2>
        {profiles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Crea un perfil primero en <Link href="/configuracion" className="underline">Configuracion</Link>.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <Link
                  href={`/biblioteca?profileId=${profile.id}`}
                  className={`rounded-md border px-3 py-1 text-xs ${
                    selectedProfile?.id === profile.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  {profile.nombre}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedProfile ? (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">Nueva carpeta</h3>
              <p className="mt-1 text-xs text-slate-600">
                Usa carpetas para organizar criterios y ejemplos por etapa o tipo de proceso.
              </p>
              <form action={createKnowledgeFolderAction.bind(null, selectedProfile.id)} className="mt-3 grid gap-2">
                <label className="text-sm text-slate-700">
                  Nombre de carpeta
                  <input
                    name="nombre"
                    required
                    placeholder="Ej: Casos ejecutivos exitosos"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Descripción (qué contiene)
                  <textarea
                    name="descripcion"
                    placeholder="Ej: Modelos de decisiones exitosas para ejecutivo con pagaré"
                    className="mt-1 h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Orden de visualización
                  <input
                    name="orden"
                    type="number"
                    min={1}
                    defaultValue={100}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-xs text-slate-500">Número menor = aparece primero.</span>
                </label>
                <div>
                  <button type="submit" className="theme-btn-primary">Crear carpeta</button>
                </div>
              </form>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">Agregar documento de biblioteca</h3>
              <form action={createKnowledgeDocumentAction.bind(null, selectedProfile.id)} className="mt-3 grid gap-2">
                <label className="text-sm text-slate-700">
                  Título del documento
                  <input
                    name="titulo"
                    required
                    placeholder="Ej: Inadmisorio ejecutivo por falta de poder"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Tipo de documento
                    <input
                      name="tipo_documento"
                      required
                      placeholder="Ej: caso_exito, criterio_despacho, nota_operativa"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Etiquetas
                    <input
                      name="etiquetas"
                      placeholder="ejecutivo,mandamiento,poder"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Carpeta destino
                    <select name="folder_id" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Sin carpeta</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Vincular a caso (opcional)
                    <select name="case_id" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="">No vincular a caso</option>
                      {(cases.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.radicado}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <input name="origen" defaultValue="manual" className="hidden" />
                <label className="text-sm text-slate-700">
                  Contenido o resumen jurídico
                  <textarea
                    name="contenido_texto"
                    placeholder="Incluye hechos clave, criterio aplicado y motivo de la decisión para que la IA lo reutilice."
                    className="mt-1 h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <div>
                  <button type="submit" className="theme-btn-primary">Guardar en biblioteca</button>
                </div>
              </form>

              <hr className="my-4 border-slate-200" />

              <h4 className="text-sm font-semibold text-slate-900">Cargue de plantillas legales</h4>
              <p className="mt-1 text-xs text-slate-600">
                Registra la plantilla con nombre para que la generación final del documento use ese texto de forma estricta.
              </p>
              <p className="mt-1 text-xs text-rose-700">
                Modo estricto legal: solo se reemplazan variables {"{{...}}"}. No se altera puntuación, comas, tildes ni redacción base.
              </p>
              <form action={createLegalTemplateUploadAction.bind(null, selectedProfile.id)} className="mt-3 grid gap-2">
                <label className="text-sm text-slate-700">
                  Nombre de plantilla
                  <input
                    name="nombre_plantilla"
                    required
                    placeholder="Ej: Auto Inadmisorio Ejecutivo Municipal v1"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Tipo de decisión
                    <select name="tipo_decision" defaultValue="general" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="general">general</option>
                      <option value="auto_admisorio">auto_admisorio</option>
                      <option value="auto_inadmisorio">auto_inadmisorio</option>
                      <option value="mandamiento_pago">mandamiento_pago</option>
                      <option value="auto_rechaza_demanda">auto_rechaza_demanda</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Etiquetas
                    <input
                      name="etiquetas"
                      placeholder="plantilla,despacho,estricta"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="text-sm text-slate-700">
                  Contenido de plantilla (HTML)
                  <textarea
                    name="contenido_plantilla_html"
                    required
                    className="mt-1 h-36 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                    placeholder="<h1>{{despacho}}</h1>\n<p>Radicado: {{radicado}}</p>"
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Usa variables como {"{{radicado}}"}, {"{{demandante}}"}, {"{{fundamento}}"}.
                  </span>
                </label>
                <div>
                  <button type="submit" className="theme-btn-primary">Guardar plantilla legal</button>
                </div>
              </form>

              <hr className="my-4 border-slate-200" />

              <h4 className="text-sm font-semibold text-slate-900">Importar archivo a biblioteca (PDF/DOCX)</h4>
              <p className="mt-1 text-xs text-slate-600">
                Carga documentos fuente y el sistema extrae texto para indexar. Si eliges "plantilla_legal", el texto cargado se usa en generación estricta.
              </p>
              <form
                action="/api/biblioteca/importar-pdf"
                method="post"
                encType="multipart/form-data"
                className="mt-3 grid gap-2"
              >
                <input type="hidden" name="profile_id" value={selectedProfile.id} />
                <label className="text-sm text-slate-700">
                  Título del documento (opcional)
                  <input
                    name="titulo"
                    placeholder="Si se deja vacío, se usa el nombre del archivo"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Tipo de documento
                    <select
                      name="tipo_documento"
                      defaultValue="caso_exito_pdf"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="caso_exito_pdf">caso_exito_pdf</option>
                      <option value="criterio_despacho">criterio_despacho</option>
                      <option value="nota_operativa">nota_operativa</option>
                      <option value="plantilla_legal">plantilla_legal</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Etiquetas
                    <input
                      name="etiquetas"
                      placeholder="ejecutivo,poder,titulo"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Carpeta destino
                    <select name="folder_id" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Sin carpeta</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Vincular a caso (opcional)
                    <select name="case_id" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="">No vincular a caso</option>
                      {(cases.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.radicado}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Tipo de decisión (texto libre)
                    <input
                      name="tipo_decision_libre"
                      placeholder="Ej: Auto inadmisorio ejecutivo"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Solo aplica para plantilla_legal. Se normaliza automáticamente.
                    </span>
                  </label>
                  <label className="text-sm text-slate-700">
                    Campos reemplazables
                    <input
                      name="campos_reemplazables"
                      placeholder="radicado,demandante,demandado,fundamento"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Lista separada por comas para trazabilidad de variables.
                    </span>
                  </label>
                </div>
                <label className="text-sm text-slate-700">
                  Texto de plantilla (opcional)
                  <textarea
                    name="contenido_plantilla_texto"
                    placeholder="Si está vacío, se toma el texto extraído del archivo. Usa variables {{radicado}}, {{demandante}}, etc."
                    className="mt-1 h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Archivo fuente
                  <input
                    type="file"
                    name="archivo_fuente"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div>
                  <button type="submit" className="theme-btn-primary">Importar archivo</button>
                </div>
              </form>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Estructura por carpetas</h2>
            {folders.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Aun no hay carpetas. Puedes crear una o guardar documentos sin carpeta.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {folders.map((folder) => {
                  const items = docsByFolder.get(folder.id) ?? [];
                  return (
                    <li key={folder.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{folder.nombre}</p>
                      {folder.descripcion ? <p className="mt-1 text-xs text-slate-600">{folder.descripcion}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">{items.length} documento(s)</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Documentos cargados</h2>
            {documents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No hay documentos en biblioteca para este perfil.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {documents.map((doc) => {
                  const folder = folders.find((item) => item.id === doc.folder_id);
                  return (
                    <li key={doc.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{doc.titulo}</p>
                          <p className="text-xs text-slate-600">
                            Tipo: {doc.tipo_documento}
                            {folder ? ` · Carpeta: ${folder.nombre}` : " · Sin carpeta"}
                          </p>
                          {doc.etiquetas.length > 0 ? (
                            <p className="mt-1 text-xs text-slate-500">Etiquetas: {doc.etiquetas.join(", ")}</p>
                          ) : null}
                        </div>
                        <form action={archiveKnowledgeDocumentAction.bind(null, selectedProfile.id, doc.id)}>
                          <button type="submit" className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700">
                            Archivar
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
