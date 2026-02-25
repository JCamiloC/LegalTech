# DOCUMENTACIÓN MAESTRA DEL PROYECTO LEGALTECH

Este documento reemplaza la documentación anterior y define el alcance real del producto.

## 1) Objetivo oficial del producto

Construir un asistente legal para abogados que:

1. Reciba uno o varios PDFs con OCR (demanda + anexos/documentos).
2. Extraiga automáticamente la mayor cantidad posible de datos del proceso.
3. Cree un caso estructurado y detallado en base de datos.
4. Analice el caso con un LLM legal (sin reglas manuales por el usuario final).
5. Presente una recomendación jurídica explicada y conversable con el abogado.
6. Aprenda del feedback del abogado para adaptarse al estilo de trabajo.
7. Al finalizar el caso, genere DOCX desde la plantilla correspondiente al resultado final.

La decisión final siempre la toma el abogado.

---

## 2) Flujo objetivo (end-to-end)

## 2.1 Ingesta documental

- El abogado carga 1..N PDFs (demanda y anexos).
- El sistema parsea texto OCR y segmenta contenido por documento.
- El LLM extractor devuelve campos estructurados del proceso.

## 2.2 Creación automática de caso

- Se crea un borrador de caso con campos predefinidos y completos.
- El abogado revisa/ajusta datos antes de confirmar guardado.

## 2.3 Biblioteca jurídica (core)

- Se elimina la gestión manual de reglas para usuario final.
- Se centraliza una biblioteca jurídica con:
  - documentos normativos cargados,
  - enlaces autorizados,
  - futuras conexiones API jurídicas.
- Esta biblioteca alimenta el contexto del LLM legal.

## 2.4 Recomendación legal conversable

- En detalle del caso aparece sección “Recomendación asistente legal”.
- El LLM produce resumen experto con fundamento legal y trazas de soporte.
- El abogado conversa, corrige y retroalimenta.
- El sistema guarda memoria de interacción por caso/abogado.

## 2.5 Cierre y documento final

- El abogado define decisión final (estado de cierre).
- Se toma la tipificación final acordada.
- Se selecciona plantilla DOCX según resultado (p. ej. inadmisión, admisión, mandamiento, rechazo).
- Se autocompletan campos y se habilita descarga de DOCX para ajustes finales del abogado.

---

## 3) Rediseño funcional requerido

## 3.1 Módulo de casos (nuevo enfoque)

- Mantener módulo de casos, pero ampliar campos y estructura.
- Reemplazar captura mínima por formulario enriquecido.
- Campos clave sugeridos (mínimo):
  - identificación: radicado, despacho, fecha, juez/secretaría,
  - partes: demandante(s), demandado(s), apoderados,
  - proceso: tipo, subtipo, cuantía, competencia, pretensiones,
  - anexos: lista, tipo, estado de validación,
  - hallazgos OCR/LLM: hechos, riesgos, observaciones.

## 3.2 Módulo de reglas

- Dejar de ser eje principal de operación para abogado.
- Se puede conservar internamente como capa de validación técnica opcional.
- UI de reglas no será flujo principal del producto.

## 3.3 Módulo de biblioteca jurídica (nuevo core)

- Crear módulo dedicado de fuentes legales:
  - `library_sources` (metadatos de fuente),
  - `library_documents` (archivos/texto),
  - `library_chunks` (segmentación para recuperación/RAG),
  - `library_links` (fuentes web aprobadas).

## 3.4 Módulo de asistente legal LLM

- Submódulos:
  - extractor documental,
  - recomendador jurídico,
  - memoria de conversación,
  - feedback loop abogado.
- Debe registrar trazabilidad de respuesta y evidencia utilizada.

## 3.5 Módulo de documentos DOCX

- Una plantilla por tipificación final.
- Llenado automático por variables de caso + conclusión final.
- Descarga directa para revisión final de abogado.

---

## 4) Arquitectura objetivo

## 4.1 Aplicación

- Frontend + backend app (Next.js) mantiene arquitectura modular.
- API interna para orquestar:
  - parseo de PDFs,
  - consulta LLM,
  - recuperación de biblioteca,
  - generación DOCX.

## 4.2 LLM offline

- Integrar runtime local/autohospedado para inferencia (sin dependencia directa de SaaS en flujo principal).
- Mantener fallback determinístico cuando LLM no esté disponible.

## 4.3 Persistencia

- Se puede mantener Supabase inicialmente para acelerar.
- Si se exige offline total, migrar a stack self-hosted en la misma red/infra.

---

## 5) Modelo de datos objetivo (propuesto)

Tablas existentes a mantener y ampliar:

- `cases` (ampliada con más metadatos jurídicos)
- `decisions`
- `document_templates`
- `assistant_interactions`

Tablas nuevas propuestas:

- `case_documents` (documentos PDF por caso)
- `case_document_extractions` (salida estructurada del LLM extractor)
- `library_sources`
- `library_documents`
- `library_chunks`
- `assistant_sessions`
- `assistant_messages`
- `assistant_feedback_events`

Se requiere nueva ronda de migraciones SQL.

---

## 6) Plan técnico por fases

## Fase 1 (MVP operativo)

1. Ingesta multi-PDF robusta.
2. Extracción estructurada con LLM.
3. Formulario de caso enriquecido con campos predefinidos.
4. Recomendación legal en detalle de caso.
5. Feedback abogado y memoria persistente.
6. DOCX por tipificación final.

## Fase 2

1. Biblioteca jurídica con indexación y recuperación semántica.
2. Respuestas con citas y trazabilidad más estricta.
3. Ajuste del estilo por perfil de abogado/despacho.

## Fase 3

1. Evaluación de calidad legal (bench interno).
2. Guardrails y auditoría avanzada.
3. Optimización de costos/rendimiento del runtime LLM.

---

## 7) Rediseño de despliegue (Azure)

## 7.1 Situación actual

- App desplegada en Azure App Service.
- Válido para web app, pero limitado para instalar y operar LLMs locales pesados.

## 7.2 Decisión recomendada

Migrar a infraestructura tipo VPS/VM en Azure para controlar runtime LLM.

Arquitectura sugerida:

- Azure VM (Ubuntu) como host principal.
- Docker Compose para:
  - `web` (Next.js),
  - `llm-runtime` (motor local),
  - `worker` (ingesta/documentos),
  - opcional `vector-db` local.

Supabase puede mantenerse al inicio.

## 7.3 Plan detallado de salida de App Service

1. Preparar VM Azure (red, discos, seguridad, backups).
2. Containerizar app y servicios auxiliares.
3. Configurar variables y secretos en VM (no en código).
4. Desplegar entorno staging en VM.
5. Ejecutar pruebas funcionales completas.
6. Configurar dominio/certificados apuntando a VM.
7. Cutover controlado (ventana de cambio).
8. Monitorear 24-72h.
9. Decomisionar App Service solo cuando haya estabilidad validada.

## 7.4 Runbook de decommission seguro

No eliminar App Service inmediatamente.

- Semana 1: App Service como rollback standby.
- Semana 2: confirmar estabilidad + performance + logs.
- Semana 3: retirar App Service y limpiar recursos/costos.

Runbook operativo detallado:

- `docs/MIGRACION_AZURE_VM_LLM.md`

---

## 8) Seguridad y cumplimiento

- Mantener control de acceso y auditoría de acciones.
- Evitar exposición de datos sensibles en logs.
- Guardar historial de recomendaciones y correcciones.
- Incluir disclaimers: recomendación asistida, decisión final humana.

---

## 9) Criterio de éxito del nuevo producto

Se considera éxito cuando:

1. El abogado carga varios PDFs y se autocompleta el caso con alto detalle.
2. El asistente legal propone recomendación argumentada y conversable.
3. El sistema aprende del feedback y mejora consistencia por abogado.
4. El cierre del caso genera DOCX correcto según tipificación final.
5. La operación queda estable en infraestructura apta para LLM offline.

---

## 10) Regla de documentación

Este archivo es la única fuente oficial de alcance, arquitectura objetivo y despliegue.
Los demás `.md` quedan como apuntadores de referencia.