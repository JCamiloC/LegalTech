# DOCUMENTACIÓN MAESTRA — Asistente de tutelas

Referencia técnica consolidada. La visión de producto está en `docs/VISION_TUTELAS.md`.

---

## 1) Objetivo del producto

Asistir al abogado del despacho judicial en el trámite de **acciones de tutela**:

1. **Capturar contexto** desde PDFs tal como llegaron al juzgado.
2. **Prellenar un formulario editable** con extracción híbrida (reglas + IA).
3. **Conversar con un asistente** para analizar admisión/rechazo con base en la biblioteca normativa.
4. **Generar un borrador Word** con el formato del despacho para revisión final.

La decisión jurídica definitiva es siempre del abogado.

---

## 2) Flujo de usuario

```
/login → /tutelas → /tutelas/nueva
                          │
          ┌───────────────┴───────────────┐
          │ Pestaña 1: Contexto         │
          │  • Subir PDFs                 │
          │  • Ver/editar pre-formulario  │
          └───────────────┬───────────────┘
                          │
          ┌───────────────┴───────────────┐
          │ Pestaña 2: Decisión           │
          │  • Chat con asistente IA      │
          │  • Consenso de veredicto      │
          │  • Generar borrador DOCX      │
          └───────────────────────────────┘

/biblioteca (aparte) — normas, decretos, jurisprudencia
```

---

## 3) Estrategia de extracción PDF

### Pipeline híbrido (recomendado)

```
PDF → Parseo (pdf-parse / Docling) → Texto por documento
    → Heurísticas (regex) → radicado, fechas, IDs
    → LLM (JSON) → hechos, pretensiones, derechos, partes
    → Formulario con confianza + evidencia por campo
    → Abogado corrige
```

**No usar solo regex** (formatos variables). **No usar solo LLM** (alucinaciones, costo). El código en `src/modules/llm/extraction.service.ts` ya implementa este patrón; debe adaptarse al schema de tutela.

### Campos críticos tutela

- Accionante, accionados, derechos invocados, pretensiones, hechos resumidos, radicado

---

## 4) Estrategia Word (DOCX)

```
Veredicto + contexto → LLM genera JSON de redacción
                     → docxtemplater rellena plantilla .docx del juzgado
                     → Descarga borrador
```

- **docxtemplater:** producción (preserva formato judicial)
- **mammoth:** leer tutelas previas como referencia de estilo
- **docx (actual):** deprecar para respuestas finales — solo genera texto plano

---

## 5) Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js App Router, React |
| Backend | Next.js API routes, Server Actions |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| PDF | pdf-parse (+ OCR fallback; Docling en roadmap) |
| IA extracción + chat | Ollama (local) o Gemini/GPT (API) |
| Word | docxtemplater (por implementar) |
| Biblioteca | Texto + chunks para RAG |

---

## 6) Módulos del código (mapeo)

| Módulo actual | Uso en tutelas v1 |
|---------------|-------------------|
| `src/modules/llm/extraction.service.ts` | Adaptar schema tutela |
| `src/modules/llm/decision.service.ts` | Evolucionar a chat |
| `src/modules/knowledge/` | Biblioteca + RAG |
| `src/modules/documents/` | Migrar a docxtemplater |
| `app/casos/` | Renombrar → `app/tutelas/` |
| `app/biblioteca/` | Mantener |

---

## 7) Modelo de datos (simplificado tutela)

### `tutelas`

- id, radicado, estado (borrador | en_analisis | resuelta)
- accionante_json, accionados_json
- hechos, pretensiones, derechos_invocados
- medida_provisional, checklist_json
- veredicto_confirmado, fundamento_final
- created_at, updated_at, user_id

### `tutela_documents`

- tutela_id, filename, storage_path, extracted_text, page_count

### `tutela_messages`

- tutela_id, role (user | assistant), content, sources_json, created_at

### `knowledge_documents` (biblioteca)

- titulo, tipo, contenido_texto, etiquetas, file_path

---

## 8) IA — configuración

Ver decisiones completas en `docs/PLAN_IA_Y_AGENTE.md`.

### Producción (recomendado)

| Tarea | Modelo |
|-------|--------|
| Extracción PDF | Gemini 2.5 Flash |
| Chat decisión + redacción | Claude Sonnet 4 |
| Reintento JSON estricto | GPT-4o-mini (opcional) |

### Fallback / desarrollo

- Ollama: `qwen2.5:14b-instruct-q4_K_M`
- Variables: `OLLAMA_BASE_URL`, `LEGAL_LLM_FALLBACK_PROVIDER=ollama`

### Costo estimado

~$0.25–0.35 USD por tutela completa (~100 tutelas/mes ≈ $30/mes).

---

## 9) Despliegue local

```bash
cp .env.example .env.local
# Configurar Supabase + Ollama
npm install
npm run dev
```

Ollama:

```bash
ollama pull qwen2.5:14b-instruct-q4_K_M
ollama serve
```

---

## 10) Documentos relacionados

- `docs/VISION_TUTELAS.md` — visión y análisis PDF/Word
- `docs/ROADMAP_TUTELAS.md` — fases de implementación
- `docs/PLAN_IA_Y_AGENTE.md` — IA, agente, plantilla al final del chat
- `docs/MATRIZ_EVALUACION_PRECISION_CASOS.md` — QA

---

## 11) Lo que quedó fuera de alcance (v1)

- Calificación de demandas ejecutivas/verbales/ordinarias
- Perfiles por cargo (juez, secretario, escribiente)
- Checklist configurable multi-proceso
- Integración con sistemas Rama Judicial
