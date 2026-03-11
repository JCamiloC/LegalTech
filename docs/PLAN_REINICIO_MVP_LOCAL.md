# Roadmap completo — LegalTech MVP con IA local

**Este documento es autocontenido. Si lees esto en una maquina nueva sin contexto previo, tiene todo lo necesario para entender el proyecto, el estado actual del codigo y como implementar cada sprint.**


---

## PARTE 1 — CONTEXTO DEL NEGOCIO

### Que hace la abogada hoy (proceso manual)

La abogada es oficial mayor de un despacho judicial. Su trabajo diario es calificar demandas:

1. Recibe la demanda en papel o PDF junto con sus anexos.
2. Lee la demanda completa para entender el caso.
3. Verifica manualmente que la demanda tenga todos los requisitos procesales:
   - Que cumpla el articulo 82 del CGP (requisitos formales de la demanda).
   - Que los anexos esten completos segun el tipo de proceso.
   - Que haya poder si actua apoderado.
   - Que tenga legitimacion en la causa.
   - Que el despacho sea competente territorialmente.
   - Si es ejecutivo: que el titulo ejecutivo sea valido.
   - Que no haya acumulacion indebida de pretensiones.
   - Que no haya caducidad ni prescripcion.
4. Busca las bases legales aplicables al caso (CGP, jurisprudencia, etc).
5. Define la decision: admitir, inadmitir, mandar pagar o rechazar.
6. Redacta el auto con la motivacion juridica y la decision.
7. Genera el documento final en una plantilla y lo pasa al juez para revision.

**Cuello de botella principal:** los pasos 2, 3, 4 y 6 son completamente manuales y consumen la mayor parte del tiempo, incluso cuando el caso es similar a uno ya resuelto antes.

**Variabilidad:** cada abogado litigante formatea la demanda distinto. No hay un formato unico. Por eso regex solos no son suficientes para extraer los campos: se necesita IA para entender el contenido sem·antico.

---

### Que quiere el producto

Que la abogada cargue el PDF y el sistema haga automaticamente lo siguiente:

1. Lea y entienda la demanda sin importar su formato.
2. Extraiga todos los campos del caso (partes, tipo proceso, cuantia, etc).
3. Evalúe simultaneamente los requisitos procesales del checklist.
4. Haga un inventario de los anexos cargados y detecte cuales faltan.
5. Proponga la decision juridica con fundamento normativo.
6. Redacte el borrador de la parte motiva del auto.
7. Genere el DOCX listo para que la abogada solo revise y firme.

**La decision final siempre la toma la abogada. La IA asiste, no decide.**

---

## PARTE 2 — FLUJO OBJETIVO DEL SISTEMA

```
[Abogada carga demanda PDF + anexos PDF]
                |
                v
     [OCR: extraccion de texto de todos los PDFs]
       (ya existe con pdf-parse en el proyecto)
                |
                v
 [LLM — Prompt 1: Analisis completo de demanda]
   Extrae en un solo llamado:
     - Campos del caso (radicado, partes, tipo, cuantia...)
     - Evaluacion del checklist procesal (cumple/no cumple cada requisito)
     - Inventario de documentos encontrados vs requeridos por tipo de proceso
     - Nivel de confianza por campo (alto/medio/bajo)
                |
                v
  [Formulario prellenado con indicadores de confianza]
  [Checklist pre-evaluado — abogada solo confirma o corrige]
  [Lista de anexos: encontrados ✓ / faltantes ✗]
                |
                v
        [Abogada revisa, corrige y guarda]
                |
                v
 [LLM — Prompt 2: Sugerencia de decision juridica]
   Usa como contexto:
     - Datos del caso confirmados
     - Resultado del checklist
     - Reglas procesales activas en el sistema
     - Hasta 10 casos historicos similares con su decision final
   Produce:
     - Tipo de decision sugerida (admision/inadmision/mandamiento/rechazo)
     - Articulos legales citados como fundamento
     - Borrador de la parte motiva del auto (texto juridico redactado)
     - Nivel de confianza de la sugerencia
                |
                v
  [Abogada ve la sugerencia + borrador del auto]
  [Confirma o ajusta la decision y el texto]
                |
                v
  [Sistema genera DOCX con plantilla completa]
  - Variables del caso insertadas automaticamente
  - Texto de la parte motiva redactado por IA incluido
  - Listo para revision y firma del juez
                |
                v
         [Descarga DOCX]
```

---

## PARTE 3 — DECISIONES TECNICAS

### Un modelo, dos prompts (no dos modelos)

No se usan dos modelos separados. Usar dos modelos en la misma maquina duplica el consumo de RAM sin ventaja real para este caso de uso.

La solucion es un unico modelo con dos prompts especializados:

- **Prompt 1 (extraccion + checklist + inventario):** optimizado para leer texto juridico y devolver JSON estructurado.
- **Prompt 2 (analisis + decision + redaccion):** optimizado para razonar juridicamente y redactar texto formal.

### Runtime local: Ollama

Ollama ejecuta modelos LLM localmente en la maquina. Es gratuito, open-source y no envia datos a servidores externos.

Instalacion: https://ollama.com/download

### Modelo recomendado: Qwen 2.5 Instruct

| RAM disponible | Modelo a usar | Comando de descarga |
|---|---|---|
| 8 GB | qwen2.5:7b-instruct-q4_K_M | `ollama pull qwen2.5:7b-instruct-q4_K_M` |
| 16 GB | qwen2.5:14b-instruct-q4_K_M | `ollama pull qwen2.5:14b-instruct-q4_K_M` |
| 32 GB+ | qwen2.5:14b-instruct-q8_0 | `ollama pull qwen2.5:14b-instruct-q8_0` |

Qwen 2.5 fue seleccionado porque:
- Rendimiento excelente en espanol juridico.
- Respeta instrucciones de formato JSON con alta fidelidad.
- Cuantizacion Q4 mantiene buena calidad con bajo consumo.

### Costo total del MVP local: $0

| Componente | Costo |
|---|---|
| Ollama (runtime) | Gratis — open source |
| Qwen 2.5 (modelo) | Gratis — open weights |
| Maquina de pruebas | Ya la tienes |
| Supabase free tier | Gratis hasta 500MB |
| **Total** | **$0** |

Si en el futuro se necesita despliegue en nube: Azure VM Standard_D4s_v5 ~$150 USD/mes.

---

## PARTE 4 — ESTADO ACTUAL DEL CODIGO

**Repositorio:** https://github.com/JCamiloC/LegalTech
**Stack:** Next.js 16, TypeScript, Supabase (DB + Auth), App Router, Tailwind CSS.

### Rutas activas (ya funcionan)

```
/                   → Landing / home
/login              → Autenticacion
/registro           → Registro de usuario
/casos              → Listado de casos
/casos/nuevo        → Crear nuevo caso (incluye carga de PDF)
/casos/[id]         → Detalle del caso: checklist, evaluacion, decision, documento
/reglas             → Gestion de reglas procesales
/plantillas         → Gestion de plantillas DOCX
/articulos          → Base de articulos legales de referencia
/documentos/preview → Vista previa del documento generado
/documentos/descargar → Descarga DOCX generado
```

### Modulos existentes (`src/modules/`)

```
cases/
  case.repository.ts    → CRUD de casos contra Supabase
  case.service.ts       → Logica de negocio de casos
  process-options.ts    → Catalogo de tipos de proceso (ejecutivo, verbal, monitorio...)
  index.ts

rules/
  rule.repository.ts    → CRUD de reglas
  rule.service.ts
  rule-engine.ts        → Motor que evalua condiciones de reglas contra datos del caso
  index.ts

decisions/
  decision.repository.ts
  decision.service.ts
  index.ts

documents/
  document.service.ts   → buildDocumentPreview, createDocxBufferFromTemplate
  template.service.ts   → renderTemplate (reemplaza variables {{campo}} en HTML)
  template.repository.ts
  institutional-template.service.ts
  storage.service.ts
  template-management.service.ts
  index.ts

legal/
  legal-articles.repository.ts  → CRUD de articulos legales
  index.ts

audit/
  audit.repository.ts
  audit.service.ts
  index.ts

auth/
  auth.service.ts
  index.ts
```

### Tipos principales (`src/types/case.ts`)

```typescript
interface CaseRecord {
  id: string;
  radicado: string;
  demandante_nombre: string;
  demandado_nombre: string;
  tipo_proceso: string;           // ejecutivo | verbal | monitorio | ordinario
  subtipo_proceso: string | null;
  cuantia: number | null;
  competencia_territorial: string | null;
  despacho: string | null;
  estado: "pendiente" | "en_revision" | "decidido";
  decision_sugerida: DecisionType | null;
  decision_final: DecisionType | null;
  created_at: string;
  updated_at: string;
}

interface CaseRequirementsCheck {
  id: string;
  case_id: string;
  cumple_art_82: boolean;
  anexos_completos: boolean;
  poder_aportado: boolean;
  legitimacion_causa: boolean;
  competencia_valida: boolean;
  titulo_ejecutivo_valido: boolean;
  indebida_acumulacion: boolean;
  caducidad: boolean;
  prescripcion: boolean;
  observaciones: string | null;
  created_at: string;
}

type DecisionType = "auto_admisorio" | "auto_inadmisorio" | "mandamiento_pago" | "auto_rechaza_demanda";
```

### Extraccion actual desde PDF (problema que se resuelve en Sprint 1)

En `app/casos/actions.ts` existe `parseDemandDocumentAction`:
- Usa `pdf-parse` para extraer texto del PDF (OCR ya funciona).
- Luego aplica regex para encontrar radicado, partes, tipo proceso, etc.
- **Problema:** los regex fallan cuando el formato de la demanda es distinto al esperado. La IA resuelve esto porque entiende el contenido semanticamente, no por patrones fijos.
- El fallback a regex debe mantenerse si el LLM no esta disponible.

### Variables de entorno requeridas (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM local — configurar en Sprint 0
LEGAL_LLM_ENABLED=false
LEGAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
LEGAL_LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
LEGAL_LLM_TIMEOUT_MS=60000
```

---

## PARTE 5 — SPRINTS DE IMPLEMENTACION

---

### SPRINT 0 — Setup Ollama local (1 dia)

**Prerequisito bloqueante: sin esto no se puede implementar Sprint 1 ni 2.**

#### Pasos:

1. Descargar e instalar Ollama desde https://ollama.com/download
2. Abrir terminal y descargar el modelo segun tu RAM:
   ```
   ollama pull qwen2.5:7b-instruct-q4_K_M
   ```
3. Verificar que el modelo responde correctamente:
   ```
   ollama run qwen2.5:7b-instruct-q4_K_M "Responde unicamente en JSON valido: {\"ok\": true}"
   ```
   Debe devolver exactamente: `{"ok": true}`
4. Configurar en `.env.local` del proyecto:
   ```
   LEGAL_LLM_ENABLED=true
   LEGAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
   LEGAL_LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
   LEGAL_LLM_TIMEOUT_MS=60000
   ```
5. Iniciar el proyecto: `npm run dev`

#### Criterio de exito:
- `ollama list` muestra el modelo descargado.
- El modelo responde JSON valido desde terminal.
- La app corre en `localhost:3000` sin errores.

---

### SPRINT 1 — Extraccion inteligente desde PDF con LLM (3-4 dias)

**Objetivo:** reemplazar los regex de `parseDemandDocumentAction` con un LLM que entienda cualquier formato de demanda. En el mismo llamado al LLM tambien se evalua el checklist y se hace el inventario de anexos.

#### Que se crea:

**`src/modules/llm/llm-client.ts`**
Modulo base que llama a la API de Ollama. Recibe prompt, devuelve string. Maneja timeout y errores. Verifica `LEGAL_LLM_ENABLED` antes de llamar.

```typescript
// Interfaz esperada
export async function callLlm(prompt: string): Promise<string | null>
// Devuelve null si LLM esta deshabilitado o si hay error/timeout
```

**`src/modules/llm/extraction-prompt.ts`**
Funcion que construye el prompt de extraccion dado el texto OCR de los PDFs.

El prompt debe:
- Indicar que es un asistente juridico colombiano.
- Pedir que extraiga los campos del caso.
- Pedir que evalúe cada campo del checklist con true/false y una nota de razon.
- Pedir que liste los documentos identificados y los que faltan segun tipo de proceso.
- Pedir nivel de confianza por campo (alto/medio/bajo).
- Pedir que responda UNICAMENTE en JSON, sin markdown, sin texto adicional.

Estructura JSON que debe devolver el LLM:
```json
{
  "campos_caso": {
    "radicado": { "valor": "2024-00123", "confianza": "alto" },
    "tipo_proceso": { "valor": "ejecutivo", "confianza": "alto" },
    "subtipo_proceso": { "valor": "con garantia real", "confianza": "medio" },
    "demandante_nombre": { "valor": "Banco XYZ S.A.", "confianza": "alto" },
    "demandado_nombre": { "valor": "Juan Perez Gomez", "confianza": "alto" },
    "cuantia": { "valor": 15000000, "confianza": "medio" },
    "competencia_territorial": { "valor": "Bogota D.C.", "confianza": "alto" },
    "despacho": { "valor": "Juzgado 5 Civil Municipal", "confianza": "bajo" },
    "pretensiones_resumen": { "valor": "...", "confianza": "medio" },
    "hechos_resumen": { "valor": "...", "confianza": "medio" },
    "fecha_demanda": { "valor": "2024-03-10", "confianza": "alto" }
  },
  "checklist": {
    "cumple_art_82": { "valor": true, "razon": "La demanda contiene todos los requisitos del articulo 82 CGP" },
    "anexos_completos": { "valor": false, "razon": "No se encontro poder adjunto en los documentos" },
    "poder_aportado": { "valor": false, "razon": "El apoderado actua sin poder visible en los PDFs" },
    "legitimacion_causa": { "valor": true, "razon": "El demandante es acreedor del titulo" },
    "competencia_valida": { "valor": true, "razon": "Cuantia dentro de competencia de juez municipal" },
    "titulo_ejecutivo_valido": { "valor": true, "razon": "Pagare con firmas visibles y fecha de vencimiento" },
    "indebida_acumulacion": { "valor": false, "razon": "Sin acumulacion de pretensiones" },
    "caducidad": { "valor": false, "razon": "Accion ejecutiva dentro del termino legal" },
    "prescripcion": { "valor": false, "razon": "Sin indicios de prescripcion" }
  },
  "inventario_documentos": {
    "encontrados": ["demanda principal", "pagare", "certificado camara comercio"],
    "faltantes": ["poder del apoderado"],
    "requeridos_por_tipo_proceso": ["demanda", "titulo ejecutivo", "poder (si actua apoderado)"]
  }
}
```

**`src/modules/llm/extraction.service.ts`**
Servicio que orquesta: recibe texto OCR → llama al prompt → parsea JSON → valida estructura → devuelve resultado tipado o null.

Tambien debe tener una funcion `extractionToFormFields()` que convierte el resultado en los query params que ya usa el formulario actual (radicado, tipo_proceso, demandante_nombre, etc).

**`src/modules/llm/index.ts`**
Exporta `LlmExtractionService` y `callLlm`.

#### Cambios en codigo existente:

**`app/casos/actions.ts` → `parseDemandDocumentAction`**

El flujo debe ser:
1. Extraer texto OCR con `pdf-parse` (ya existe, no cambia).
2. Intentar extraccion con LLM si `LEGAL_LLM_ENABLED=true`.
3. Si el LLM falla o esta deshabilitado, usar el regex existente como fallback.
4. Incluir en los query params los nuevos campos: `pretensiones_resumen`, `hechos_resumen`, `checklist_json` (JSON serializado del checklist pre-evaluado), `inventario_json`.

**`app/casos/nuevo/page.tsx`**

Agregar:
- Campos de `pretensiones_resumen` y `hechos_resumen` en el formulario.
- Indicadores de confianza: campos con confianza "bajo" destacados en amarillo para que la abogada los revise.
- Seccion de checklist pre-evaluado (mostrar cada item con razon del LLM, la abogada puede corregir).
- Seccion de inventario de documentos: encontrados vs faltantes.

**`app/casos/actions.ts` → `createCaseAction`**

Al crear el caso:
- Guardar `pretensiones_resumen` y `hechos_resumen` (requiere agregar columnas a tabla `cases` en Supabase — ver migracion abajo).
- Si viene `checklist_json` en el form, guardarlo automaticamente junto con el caso para que la abogada no tenga que re-diligenciar el checklist.

#### Migracion SQL requerida (Sprint 1):

Archivo: `sql/migrations/20260311_006_case_llm_fields.sql`

```sql
-- Campos adicionales para extraccion LLM
alter table public.cases
  add column if not exists pretensiones_resumen text,
  add column if not exists hechos_resumen text,
  add column if not exists fecha_demanda date,
  add column if not exists llm_extraccion_json jsonb, -- guardar salida cruda del LLM para auditoria
  add column if not exists llm_confianza_promedio text; -- alto/medio/bajo segun promedio de campos
```

#### Criterio de exito Sprint 1:
- Cargar una demanda PDF real → formulario se rellena en menos de 30 segundos.
- Al menos 6 de 8 campos criticos correctamente extraidos.
- El checklist aparece pre-evaluado con razones del LLM.
- La lista de anexos faltantes es correcta.
- Si Ollama esta apagado, el sistema usa regex y sigue funcionando sin error.

---

### SPRINT 2 — Sugerencia de decision juridica con LLM (3-4 dias)

**Objetivo:** el sistema analiza el caso completo y sugiere la decision juridica con fundamento normativo y un borrador del auto listo para editar.

#### Que se crea:

**`src/modules/llm/decision-prompt.ts`**
Funcion que construye el prompt de analisis juridico dado:
- Los datos del caso confirmados por la abogada.
- El resultado del checklist.
- Las reglas procesales activas (del modulo `rules`).
- Hasta 10 casos historicos similares con su decision final (del historico en DB).
- Los articulos legales del catalogo (del modulo `legal`).

El prompt debe pedir que responda UNICAMENTE en JSON:
```json
{
  "decision_sugerida": "auto_inadmisorio",
  "confianza": "alto",
  "fundamento_normativo": [
    { "articulo": "Art. 82 CGP", "texto_relevante": "..." },
    { "articulo": "Art. 85 CGP", "texto_relevante": "..." }
  ],
  "analisis_checklist": "La demanda no cumple con el requisito de poder porque...",
  "parte_motiva_borrador": "CONSIDERANDO que la demanda presentada por [demandante] mediante apoderado [nombre], radicada bajo el numero [radicado], tiene por objeto [pretensiones_resumen]. Que revisada la demanda y sus anexos, se encuentra que [analisis]. Que el articulo 82 del CGP establece [cita]. Por lo anterior, este despacho INADMITE la demanda por...",
  "defectos_identificados": [
    "No se adjunto poder del apoderado judicial",
    "Falta anexo del titulo ejecutivo original"
  ],
  "casos_similares_usados": 3
}
```

**`src/modules/llm/decision.service.ts`**
Servicio que:
1. Recupera reglas activas, articulos legales y casos historicos similares.
2. Construye el prompt con toda esa informacion de contexto.
3. Llama al LLM.
4. Parsea y valida el JSON de respuesta.
5. Devuelve `LlmDecisionResult` tipado o null si falla.

Para recuperar casos similares: busca en la tabla `decisions` casos con el mismo `tipo_proceso` y `decision_final` definida, ordenados por fecha descendente, limite 10.

**`src/modules/llm/index.ts`**
Agregar exportacion de `LlmDecisionService`.

#### Cambios en codigo existente:

**`app/casos/actions.ts`**

Nueva accion `suggestDecisionAction(caseId: string)`:
1. Carga el caso, el checklist, las reglas, los articulos.
2. Llama a `LlmDecisionService`.
3. Guarda en la tabla `cases`: `decision_sugerida` y el `parte_motiva_borrador` (nuevo campo).
4. Guarda en tabla `case_ai_suggestions` (nueva, ver migracion) el registro completo de la sugerencia con todos los campos del JSON.
5. Redirige al detalle del caso con `?ok=decision_sugerida`.

**`app/casos/[id]/page.tsx`**

Nueva seccion "Sugerencia de decision con IA" que aparece despues de guardar el checklist:
- Boton "Analizar con IA" que llama a `suggestDecisionAction`.
- Si ya hay sugerencia guardada, mostrar:
  - Decision sugerida con nivel de confianza (con color: verde=alto, amarillo=medio, rojo=bajo).
  - Fundamento normativo citado.
  - Lista de defectos identificados.
  - **Borrador de la parte motiva** en un textarea editable para que la abogada corrija directamente.
- La abogada selecciona la decision final (puede ser distinta a la sugerida).
- Al guardar decision final, tambien guarda si la IA acerto (`fue_correcta: boolean`).

#### Migracion SQL requerida (Sprint 2):

Archivo: `sql/migrations/20260311_007_case_ai_decision.sql`

```sql
-- Campo para guardar el borrador de la parte motiva
alter table public.cases
  add column if not exists parte_motiva_borrador text;

-- Historico de sugerencias de IA por caso
create table if not exists public.case_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_sugerida text not null,
  confianza text not null,
  fundamento_json jsonb,
  analisis_checklist text,
  parte_motiva_borrador text,
  defectos_json jsonb,
  casos_similares_usados integer default 0,
  fue_correcta boolean,           -- null hasta que la abogada confirme la decision final
  decision_final_real text,       -- la que eligio la abogada
  created_at timestamp not null default now()
);

create index if not exists idx_case_ai_suggestions_case_id
  on public.case_ai_suggestions(case_id);
create index if not exists idx_case_ai_suggestions_tipo_proceso
  on public.case_ai_suggestions(created_at desc);
```

#### Criterio de exito Sprint 2:
- El sistema sugiere decision en menos de 60 segundos tras guardar checklist.
- El borrador de la parte motiva tiene estructura juridica coherente.
- La abogada puede editar el borrador directamente en pantalla.
- El sistema registra si la IA acerto o no para mejorar con el tiempo.

---

### SPRINT 3 — DOCX con todos los campos nuevos (2-3 dias)

**Objetivo:** el documento generado incluye todos los campos extraidos por IA, especialmente la parte motiva redactada.

#### Que se modifica:

**Plantillas en Supabase (tabla `document_templates`)**

Cada plantilla debe tener nuevas variables disponibles:
```
{{pretensiones_resumen}}
{{hechos_resumen}}
{{fecha_demanda}}
{{parte_motiva}}          ← texto redactado por IA, editado por abogada
{{defectos_identificados}} ← lista de defectos si la decision es inadmision
{{fundamento_normativo}}  ← articulos citados por la IA
```

**`app/casos/actions.ts` → `generateDecisionDocumentAction`**

Al construir las variables del template, incluir:
- `pretensiones_resumen` del caso.
- `hechos_resumen` del caso.
- `parte_motiva` desde el campo `parte_motiva_borrador` del caso (que la abogada ya edito).
- `defectos_identificados` desde la ultima sugerencia de IA del caso.
- `fundamento_normativo` formateado para el documento.

**`app/casos/[id]/page.tsx`**

Antes de permitir generar el DOCX, mostrar una validacion visual de campos incompletos:
- Si `parte_motiva_borrador` esta vacio, mostrar advertencia.
- Si `pretensiones_resumen` esta vacio, mostrar advertencia.
- El boton de generar sigue funcionando siempre (la abogada decide si continua).

#### Criterio de exito Sprint 3:
- El DOCX generado no requiere que la abogada corrija datos del caso manualmente.
- La parte motiva aparece en el documento con el texto que ella aprobo.
- Los articulos legales citados por la IA aparecen en el documento.

---

### SPRINT 4 — Historico, metricas y mejora continua (2 dias)

**Objetivo:** el sistema aprende con cada caso cerrado y la abogada puede ver que tan precisa es la IA.

#### Que se crea:

**`app/casos/page.tsx`**
Agregar panel de metricas simple visible para la abogada:
- Total de casos procesados con IA.
- Porcentaje de sugerencias aceptadas sin cambio.
- Porcentaje de inadmisiones vs admisiones historicas.

**Logica de casos similares (mejora Sprint 2)**
En `LlmDecisionService`, mejorar la recuperacion de casos similares:
- Filtrar por `tipo_proceso` igual al caso actual.
- Incluir el analisis de checklist de cada caso similar.
- Indicar si la IA habia acertado en esos casos.

#### Migracion SQL requerida (Sprint 4):

No requiere nuevas tablas. Solo indices adicionales para mejorar velocidad de consulta de historico.

```sql
-- Optimizar busqueda de casos similares
create index if not exists idx_cases_tipo_proceso_estado
  on public.cases(tipo_proceso, estado);

create index if not exists idx_case_ai_suggestions_fue_correcta
  on public.case_ai_suggestions(fue_correcta);
```

#### Criterio de exito Sprint 4:
- Despues de 20 casos cerrados, la precision de la IA supera el 75%.
- La abogada puede ver en pantalla cuantas veces ha aceptado la sugerencia de la IA.

---

## PARTE 6 — ORDEN DE EJECUCION Y DEPENDENCIAS

```
Sprint 0 (obligatorio primero)
    └── Sprint 1 (extraccion LLM)
            └── Sprint 2 (decision LLM)  ← depende de Sprint 1 para tener campos completos
                    └── Sprint 3 (DOCX mejorado)  ← depende de Sprint 2 para parte_motiva
                            └── Sprint 4 (historico)  ← depende de tener casos cerrados
```

Cada sprint es deployable y util por si solo. Sprint 1 ya da valor aunque Sprint 2 no este listo.

---

## PARTE 7 — CHECKLIST DE ARRANQUE EN MAQUINA NUEVA

Si estas en una maquina nueva con el repo clonado por primera vez:

```
[ ] 1. npm install
[ ] 2. Copiar .env.example a .env.local y llenar credenciales de Supabase
[ ] 3. Ejecutar migraciones SQL en Supabase (carpeta sql/migrations/, en orden numerico)
[ ] 4. npm run dev — verificar que corre en localhost:3000
[ ] 5. Instalar Ollama: https://ollama.com/download
[ ] 6. ollama pull qwen2.5:7b-instruct-q4_K_M
[ ] 7. Verificar con: ollama run qwen2.5:7b-instruct-q4_K_M "Responde solo JSON: {\"ok\":true}"
[ ] 8. Cambiar en .env.local: LEGAL_LLM_ENABLED=true
[ ] 9. Reiniciar npm run dev
[ ] 10. Listo para implementar Sprint 1
```

---

## PARTE 8 — FUENTES DE VERDAD

| Documento | Proposito |
|---|---|
| `DOCUMENTACION_PROYECTO.md` (raiz) | Estrategia y arquitectura general del producto |
| `docs/PLAN_REINICIO_MVP_LOCAL.md` (este archivo) | Guia de implementacion sprint a sprint |
| `sql/migrations/` | Historial de esquema de base de datos |
| `src/types/case.ts` | Tipos TypeScript del dominio principal |
| `src/modules/` | Logica de negocio por dominio |
| `app/casos/actions.ts` | Server actions del flujo principal de casos |

**Un solo modelo, dos prompts especializados.**

No se necesitan dos modelos separados. Usar dos modelos locales duplicaria el consumo de RAM sin ventaja real. Un modelo como Qwen 2.5 puede hacer extraccion estructurada Y analisis juridico con prompts distintos para cada tarea.

**Costo de los LLMs: $0.**
- Ollama es gratuito y open-source.
- Los modelos se descargan una sola vez.
- No hay API, no hay suscripcion, no hay cobro por tokens.
- Solo consume electricidad y tiempo de computo local.

---

## Flujo objetivo del producto

```
[PDF demanda + anexos]
        |
        v
[LLM extrae campos estructurados]   <-- Prompt 1: extraccion
        |
        v
[Formulario prellenado con datos]
        |
        v
[Abogada revisa y confirma caso]
        |
        v
[Checklist procesal]
        |
        v
[LLM sugiere decision juridica]     <-- Prompt 2: analisis
  + reglas activas
  + historico de casos anteriores
        |
        v
[Abogada confirma o ajusta decision]
        |
        v
[Generacion DOCX por plantilla]
        |
        v
[Descarga y revision final]
```

---

## Requisitos de hardware (local)

| Maquina | Modelo recomendado | RAM necesaria |
|---|---|---|
| Laptop con 8GB RAM | Qwen 2.5 7B Q4 | ~5GB |
| PC con 16GB RAM | Qwen 2.5 14B Q4 | ~10GB |
| PC con 32GB+ RAM | Qwen 2.5 14B Q8 | ~16GB |

El modelo Q4 es cuantizado (mas ligero, calidad muy buena para este caso de uso).

---

## Sprint 0 — Prerequisitos (1 dia)

**Objetivo:** tener Ollama corriendo localmente con el modelo descargado.

### Pasos:

1. Descargar e instalar Ollama: https://ollama.com/download
2. Descargar el modelo segun tu maquina:
   ```
   ollama pull qwen2.5:7b-instruct-q4_K_M
   ```
   o si tienes 16GB+:
   ```
   ollama pull qwen2.5:14b-instruct-q4_K_M
   ```
3. Verificar que responde:
   ```
   ollama run qwen2.5:7b-instruct-q4_K_M "Hola, responde en JSON: {\"ok\": true}"
   ```
4. Agregar variable de entorno al proyecto:
   ```
   LEGAL_LLM_ENABLED=true
   LEGAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
   LEGAL_LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
   LEGAL_LLM_TIMEOUT_MS=60000
   ```

### Criterio de exito:
- Ollama responde JSON valido desde terminal.
- Variables de entorno configuradas en `.env.local`.

---

## Sprint 1 — Extraccion inteligente desde demanda PDF (3-4 dias)

**Objetivo:** reemplazar la extraccion por regex con LLM para cubrir cualquier formato de demanda.

### Que se implementa:

- Nuevo servicio `LlmExtractionService` que recibe texto OCR del PDF.
- Prompt especializado en extraccion juridica colombiana.
- Salida JSON validada y tipada con todos los campos del caso.
- Indicador de confianza por campo (alto / medio / bajo).
- Fallback al regex existente si el LLM no esta disponible.

### Campos que extrae el LLM:

```json
{
  "radicado": "...",
  "tipo_proceso": "...",
  "subtipo_proceso": "...",
  "demandante_nombre": "...",
  "demandado_nombre": "...",
  "cuantia": 0,
  "competencia_territorial": "...",
  "despacho": "...",
  "pretensiones": "...",
  "hechos_resumen": "...",
  "poder_aportado": true,
  "fecha_demanda": "...",
  "confianza": {
    "radicado": "alto",
    "tipo_proceso": "medio",
    ...
  }
}
```

### UX resultante:
- Los campos con confianza "bajo" se resaltan para que la abogada los revise.
- Los campos con "alto" se marcan como autocompletados.
- La abogada solo corrige lo necesario.

### Criterio de exito:
- Cargar una demanda PDF real y ver el formulario prellenado en menos de 30 segundos.
- Al menos 6 de 8 campos criticos correctamente extraidos.

---

## Sprint 2 — Sugerencia de decision juridica con IA (3-4 dias)

**Objetivo:** el sistema sugiere la decision juridica con fundamento, basandose en checklist + reglas + historico.

### Que se implementa:

- Nuevo servicio `LlmDecisionService`.
- Accion de servidor `suggestDecisionAction` en el detalle del caso.
- Boton "Sugerir decision con IA" visible despues de guardar checklist.
- Seccion de resultado en el detalle del caso con:
  - Decision sugerida (tipo: admision, inadmision, mandamiento, rechazo).
  - Fundamento legal citado (articulos relevantes).
  - Analisis de checklist (que cumple, que no).
  - Nivel de confianza de la sugerencia.
- Abogada confirma o ajusta antes de guardar.

### Contexto que recibe el LLM:

1. Datos del caso (tipo proceso, partes, cuantia, competencia).
2. Estado del checklist (que requisitos cumplio o no).
3. Reglas activas del sistema.
4. Hasta 10 casos historicos similares con su decision final.

### Aprendizaje incremental:

- Cada vez que la abogada confirma o corrige la sugerencia queda registrado.
- El sistema incluye ese historico en el contexto del siguiente caso.
- Gradualmente la IA aprende el patron de decisiones del despacho.

### Criterio de exito:
- En casos con checklist completo, el sistema sugiere decision en menos de 60 segundos.
- La abogada valida que la sugerencia es razonable en al menos 7 de 10 casos.

---

## Sprint 3 — Calidad documental y DOCX (2-3 dias)

**Objetivo:** el DOCX generado refleja con precision la decision y datos del caso.

### Que se implementa:

- Revision de cada plantilla por tipo de decision.
- Mapeo de todos los campos extraidos por IA a variables de la plantilla.
- Campos nuevos del Sprint 1 (pretensiones, hechos_resumen) incluidos en DOCX.
- Indicador visual de campos incompletos antes de generar documento.

### Criterio de exito:
- DOCX generado no requiere correcciones manuales de datos del caso.
- La abogada solo retoca estilo y detalles finales de redaccion.

---

## Sprint 4 — Historico y mejora continua (2 dias)

**Objetivo:** el sistema mejora con cada caso cerrado.

### Que se implementa:

- Migracion SQL para tabla `case_ai_suggestions` (sugerencia, confianza, decision_final, fue_correcta).
- Dashboard simple de precision: cuantas sugerencias acepto vs corrigio la abogada.
- Vista de casos similares en el detalle del caso actual.

### Criterio de exito:
- Despues de 20 casos, la precision de sugerencias supera el 80%.

---

## Resumen de costos

| Componente | Costo |
|---|---|
| Ollama (runtime) | $0 — open source |
| Modelo Qwen 2.5 | $0 — open weights |
| Infraestructura local | $0 — tu propia maquina |
| Supabase (base actual) | Free tier hasta 500MB |
| **Total MVP local** | **$0** |

Si en el futuro se quiere nube: Azure VM Standard_D4s_v5 ~$150 USD/mes.

---

## Estado actual del proyecto (base para estos sprints)

Lo siguiente ya existe y NO se reimplementa:

- Auth y rutas privadas: operativo.
- Gestion de casos (crear, editar, listar, eliminar): operativo.
- Extraccion basica por regex desde PDF: operativo (se mejora en Sprint 1).
- Checklist procesal: operativo.
- Motor de reglas basicas: operativo.
- Decision final y plantillas DOCX: operativo.

---

## Orden de ejecucion recomendado

```
Sprint 0 (Setup Ollama)
    -> Sprint 1 (Extraccion LLM)
    -> Sprint 2 (Sugerencia decision)
    -> Sprint 3 (Calidad DOCX)
    -> Sprint 4 (Historico)
```

Cada sprint es independiente y testeable. El producto es util desde Sprint 1.
