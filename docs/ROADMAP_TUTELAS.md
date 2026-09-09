# Roadmap — Asistente de tutelas v1

Plan de implementación alineado con `VISION_TUTELAS.md` y `PLAN_IA_Y_AGENTE.md`.

---

## Decisiones cerradas (Fase 0)

| Decisión | Resolución |
|----------|------------|
| Alcance | Solo tutelas |
| Pre-formulario | Aprobado (ver VISION §5) |
| Plantilla Word | Se sube **al final del chat**, analizada on-the-fly; no en biblioteca |
| IA producción | Router: **Gemini 2.5 Flash** (extracción) + **Claude Sonnet 4** (chat/redacción) |
| IA fallback | Ollama local |
| Agent Skills | Propias en `.cursor/skills/` para desarrollo; runtime = prompt modules + RAG |

### Pendiente del abogado (antes Fase 2)

- [ ] Configurar `GEMINI_API_KEY` y `ANTHROPIC_API_KEY`
- [ ] 5 tutelas reales anonimizadas
- [ ] 1 plantilla Word o tutela resuelta de ejemplo

---

## Estado actual del código

| Área | Estado | Acción |
|------|--------|--------|
| Auth + casos genéricos | Existe (`/casos`) | Renombrar → `/tutelas` |
| LLM client | Solo Ollama | Crear `LlmRouter` multi-proveedor |
| Extracción híbrida | Existe, schema civil | Schema tutela |
| Decisión LLM | One-shot | Chat conversacional |
| Biblioteca | Parcial | Solo normas; sin plantillas |
| DOCX | HTML → docx básico | docxtemplater + upload al final |
| UI | Multi-menú | 3 rutas: Tutelas, Biblioteca, Config |

---

## Fase 1 — Fundación UX + router IA (2 semanas)

**Objetivo:** Flujo visible end-to-end; IA cloud conectada.

### 1.1 Rutas

- [ ] `/tutelas`, `/tutelas/nueva`, `/tutelas/[id]`
- [ ] Redirect `/casos` → `/tutelas`
- [ ] Nav: **Tutelas | Biblioteca**

### 1.2 Pestaña 1 — Contexto

- [ ] Upload múltiple PDF (drag & drop)
- [ ] Pre-formulario tutela editable
- [ ] Confianza por campo (verde/ámbar/rojo)
- [ ] Botón "Continuar a decisión"

### 1.3 Pestaña 2 — Chat (UI)

- [ ] Historial persistido
- [ ] Primer mensaje automático (mock → real en Fase 3)
- [ ] Input + streaming respuesta
- [ ] Estado veredicto: propuesto → confirmado

### 1.4 Paso final — Plantilla Word (UI shell)

- [ ] Modal post-consenso: upload `.docx`
- [ ] Opciones: plantilla oficial | tutela resuelta referencia
- [ ] Botón "Generar borrador" (mock descarga en Fase 1)

### 1.5 LlmRouter (infraestructura)

- [ ] `src/modules/llm/llm-router.ts`
- [ ] Providers: `gemini`, `anthropic`, `ollama`, `openai`
- [ ] Routing: extract → gemini; chat/draft → anthropic; fallback → ollama
- [ ] Actualizar `.env.example`

### 1.6 Cursor skills (desarrollo)

- [ ] `.cursor/skills/tutela-domain/SKILL.md`
- [ ] `.cursor/skills/tutela-extraction/SKILL.md`
- [ ] `.cursor/skills/tutela-docx/SKILL.md`

### 1.7 Prompt modules (runtime)

- [ ] `prompts/tutela-extract.md`
- [ ] `prompts/tutela-analyze.md`
- [ ] `prompts/tutela-chat.md`
- [ ] `prompts/tutela-draft.md`

**Cierre Fase 1:** flujo completo recorrible; API cloud responde (aunque extracción aún no perfecta).

---

## Fase 2 — Extracción PDF tutela (2 semanas)

**Objetivo:** Formulario prellenado desde PDFs reales.

### 2.1 Parseo

```
PDF → storage → pdf-parse (+ OCR si vacío) → texto por doc + páginas
```

### 2.2 Schema tutela

- [ ] `TutelaExtractionSchema` con `{ valor, confianza, evidencia, pagina }`
- [ ] Campos: identificación, partes, derechos, hechos, pretensiones, medida provisional, checklist 2591, anexos

### 2.3 Pipeline híbrido

- [ ] Heurísticas tutela (radicado, cédulas, juzgado)
- [ ] Gemini Flash extracción JSON
- [ ] Validación schema + reintento focalizado (GPT-4o-mini strict JSON)
- [ ] **Sin truncar** expediente (aprovechar 1M context Gemini)

### 2.4 Evaluación

- [ ] Matriz con 5 tutelas reales
- [ ] Meta: ≥ 80% campos críticos antes de corrección humana

**Cierre Fase 2:** 3 PDFs → formulario usable con ≤ 5 min corrección.

---

## Fase 3 — Chat decisión + RAG (2 semanas)

**Objetivo:** Conversación jurídica trazable.

### 3.1 Motor chat

- [ ] Tabla `tutela_messages`
- [ ] Claude Sonnet con system prompt `tutela-chat.md`
- [ ] Primer mensaje auto al abrir Pestaña 2 (`tutela-analyze.md`)
- [ ] Streaming SSE al frontend

### 3.2 RAG biblioteca (solo normas)

- [ ] Chunking documentos biblioteca
- [ ] Embeddings (Gemini embedding o Supabase pgvector)
- [ ] Top-K inyectado en contexto
- [ ] UI: fuentes citadas bajo cada respuesta

### 3.3 Consenso

- [ ] Veredictos: `admitir | inadmitir | rechazar | remitir | medida_provisional`
- [ ] Botón "Confirmar veredicto" → habilita paso plantilla

**Cierre Fase 3:** chat útil en 2–3 turnos; fuentes visibles; veredicto confirmable.

---

## Fase 4 — Generación Word con plantilla fresca (2 semanas)

**Objetivo:** DOCX con formato del despacho, plantilla subida al momento.

### 4.1 Upload plantilla (runtime)

- [ ] Tabla `tutela_template_files` (por tutela, no biblioteca)
- [ ] Upload `.docx` en paso final post-consenso
- [ ] mammoth → extracción texto/estructura
- [ ] LLM mapea secciones → placeholders docxtemplater

### 4.2 Generación contenido

- [ ] Claude Sonnet + `tutela-draft.md`
- [ ] JSON: `{ encabezado, antecedentes, consideraciones, resuelve }`
- [ ] Validación campos obligatorios

### 4.3 Ensamblado

- [ ] docxtemplater merge
- [ ] Descarga `.docx`
- [ ] Deprecar `createDocxBufferFromTemplate` HTML

### 4.4 Reutilización opcional

- [ ] "Usar plantilla de tutela anterior" (mismo despacho, lista reciente)
- [ ] Siempre re-analizar al generar (no caché ciego)

**Cierre Fase 4:** borrador respeta formato subido; edición manual ≤ 20%.

---

## Fase 5 — Producción (2 semanas)

- [ ] 10 tutelas reales en matriz
- [ ] Errores: API caída → fallback Ollama; PDF corrupto; OCR vacío
- [ ] Disclaimer legal persistente
- [ ] Auditoría: qué modelo, qué fuentes biblioteca, qué plantilla
- [ ] No loguear PII en producción
- [ ] Despliegue Azure / VPS

**Cierre Fase 5:** métricas VISION §9 alcanzadas.

---

## Stack final

```
Frontend:     Next.js
Backend:      Next.js + Supabase
PDF:          pdf-parse + OCR fallback
Extracción:   Heurísticas + Gemini 2.5 Flash
Chat/Redact:  Claude Sonnet 4 + RAG biblioteca
Word:         Upload .docx → mammoth → docxtemplater
Fallback:     Ollama
Dev skills:   .cursor/skills/tutela-*
Runtime:      prompts/tutela-*.md
```

---

## Cronograma

| Fase | Semanas | Paralelo abogado |
|------|---------|------------------|
| 0 Alineación | 1 | API keys + tutelas ejemplo |
| 1 UX + router | 2 | Probar flujo mock |
| 2 Extracción | 2 | Validar matriz 5 tutelas |
| 3 Chat + RAG | 2 | Revisar calidad análisis |
| 4 Word | 2 | Validar formato despacho |
| 5 Producción | 2 | 10 tutelas finales |

**Total estimado:** ~11 semanas hasta producción candidata.

---

## Protocolo de trabajo

```
Complete U.X
Evidencia: ...
Bloqueo: ...
```

Respuesta: cambios → cómo probar 5 min → siguiente paso.
