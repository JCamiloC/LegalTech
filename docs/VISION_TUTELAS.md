# Visión del producto — Asistente de tutelas

Documento maestro de producto. Define el alcance, la estrategia técnica y los principios de UX para la primera versión en producción.

---

## 1. Problema que resolvemos

Un juzgado recibe acciones de tutela con formatos muy variables. El abogado del despacho (oficial mayor, secretario u otro) debe:

1. Leer la documentación recibida.
2. Determinar si procede admitir, rechazar o inadmitir.
3. Fundamentar la decisión en normas y jurisprudencia.
4. Redactar la respuesta en el formato que impone el juez del despacho.

Hoy ese trabajo es casi completamente manual. El producto **no reemplaza al abogado**: le reduce fricción, captura contexto y propone borradores que el abogado revisa, corrige y firma.

---

## 2. Alcance v1 — Un solo flujo: tutela

No mapeamos cargos ni tipos de proceso distintos en esta fase. Solo **tutelas**.

### Pantallas del sistema

| Ruta | Propósito |
|------|-----------|
| `/login` | Acceso |
| `/tutelas` | Lista de tutelas en curso |
| `/tutelas/nueva` | Flujo principal (2 pestañas) |
| `/biblioteca` | Normas y documentos de referencia (gestión aparte) |

### Flujo de `/tutelas/nueva`

```
Pestaña 1 — Contexto
  ├── Carga de PDFs (como llegaron al juzgado)
  ├── Extracción automática → pre-formulario editable
  └── Guardar contexto

Pestaña 2 — Decisión
  ├── Chat con asistente (IA inicia con análisis y bases legales)
  ├── Abogado corrige, complementa o cambia veredicto
  ├── Consenso → solicitar plantilla Word o tutela previa similar
  └── Generar borrador DOCX preliminar para edición final
```

**Principio UX:** pocas acciones visibles. Sin menús profundos. El abogado siempre ve qué falta y puede corregir.

---

## 3. Análisis estratégico — Extracción de PDF

### Pregunta: ¿IA pura, algoritmos puros o híbrido?

**Recomendación: pipeline híbrido en 4 capas.** Ni solo regex ni solo LLM.

| Capa | Tecnología | Qué resuelve |
|------|------------|--------------|
| **1. Parseo documental** | Docling / pdf-parse + OCR (Tesseract) si no hay capa de texto | Texto legible, orden de lectura, tablas, páginas |
| **2. Campos determinísticos** | Regex + heurísticas | Radicado, fechas, números de cédula, juzgado, listado de anexos |
| **3. Campos semánticos** | LLM con salida JSON estructurada | Hechos, pretensiones, derechos invocados, relato del accionante |
| **4. Validación humana** | Formulario editable con confianza por campo | El abogado corrige lo que la máquina no supo |

### Por qué no algoritmos solos

- Las tutelas llegan en formatos distintos según el abogado litigante.
- Los campos críticos (hechos, pretensiones, derecho vulnerado) requieren comprensión semántica.
- Regex falla cuando cambia el orden, el encabezado o la redacción.

### Por qué no IA sola

- Los LLM alucinan en documentos largos si no hay anclaje a evidencia.
- Benchmarks recientes (ExtractBench, evaluaciones CUAD) muestran degradación fuerte con esquemas amplios y PDFs complejos.
- Campos como radicado, fecha y cédula se extraen mejor y más barato con reglas.
- Estudios de corpus judicial muestran que truncar texto (p. ej. primeros 10.000 caracteres) deja fuera conclusiones en >80% de expedientes largos.

### Por qué híbrido (lo que ya empezó el código)

El proyecto ya tiene `extractHeuristicFields` + `LlmExtractionService`. Esa dirección es correcta; hay que **especializarla para tutelas** y añadir:

- Evidencia por campo (`documento_origen`, `fragmento_texto`, `pagina`)
- Confianza visual en UI (campo en ámbar si confianza baja)
- Reintento focalizado: si falta un campo crítico, segundo prompt solo para ese campo
- **Sin truncar** el expediente: chunking por sección + merge, o modelo con ventana amplia (Gemini 1.5/2.x, GPT-4o)

### Proveedor de IA recomendado

| Escenario | Opción |
|-----------|--------|
| **Desarrollo / privacidad máxima** | Ollama local (Qwen 2.5 14B) — ya integrado |
| **Mejor calidad extracción + chat** | Gemini 2.0 Flash o GPT-4o-mini vía API |
| **Parseo PDF estructurado** | Docling Serve (self-hosted) o pdf-parse + OCR fallback |

**Recomendación práctica para producción inicial:**

1. Docling o pdf-parse para texto.
2. Heurísticas para identificadores.
3. Gemini Flash o GPT-4o-mini para extracción semántica (costo bajo, JSON mode).
4. Mismo modelo (o superior) para el chat de decisión con RAG sobre biblioteca.

---

## 4. Análisis estratégico — Relleno de Word

### Pregunta: ¿La IA escribe el DOCX directamente?

**No.** Los LLM no manipulan el XML interno de Word de forma fiable. Generan texto; otro componente arma el archivo.

### Arquitectura recomendada: IA genera contenido, plantilla genera formato

```
Tutela resuelta + veredicto consensuado
        │
        ▼
LLM → JSON { consideraciones, resuelve, citas, partes... }
        │
        ▼
docxtemplater → rellena plantilla .docx del juzgado
        │
        ▼
Borrador DOCX descargable (abogado edita detalles finales)
```

### Dos fuentes de plantilla

1. **Plantilla oficial del juzgado** — Word con placeholders `{accionante}`, `{consideraciones}`, etc. El abogado la sube una vez en configuración o por tutela.
2. **Tutela previa respondida** — Se lee con `mammoth` o Docling, se identifica estructura (encabezado, considerandos, resuelve) y se usa como referencia de estilo para mapear variables.

### Librerías Node.js

| Librería | Uso |
|----------|-----|
| **docxtemplater** | Rellenar plantilla Word con JSON — preserva formato del juez |
| **mammoth** | Leer contenido de un .docx existente (tutela previa) |
| **docx** (actual) | Solo para DOCX simples sin plantilla — reemplazar en producción |

El código actual (`createDocxBufferFromTemplate`) genera DOCX desde HTML plano. **No preserva el formato judicial.** Para producción hay que migrar a docxtemplater.

### Rol de la IA en la redacción

- Genera **consideraciones** y **resuelve** en texto jurídico.
- **No** inventa hechos no presentes en el expediente.
- Cita artículos solo si están en biblioteca o en el contexto del caso.
- El abogado siempre puede editar el Word final fuera del sistema.

---

## 5. Pre-formulario de tutela (Pestaña 1)

Formulario **abierto y editable**. Campos propuestos:

### Identificación

- Radicado / número de reparto
- Juzgado / despacho
- Fecha de recepción
- Ciudad

### Partes

- Accionante (nombre, identificación, calidad)
- Accionados (lista editable: nombre, identificación, calidad)
- Apoderado del accionante (si aplica)

### Sustancia de la tutela

- Derechos constitucionales invocados
- Hechos relevantes (textarea, resumen estructurado)
- Pretensiones
- Medida provisional solicitada (sí/no + descripción)
- Fundamentos de derecho citados por el accionante

### Requisitos formales (checklist editable)

- ¿Identificación clara del accionante?
- ¿Identificación de accionados?
- ¿Relato de hechos?
- ¿Pretensiones claras?
- ¿Fundamento en derechos fundamentales?
- ¿Anexos mínimos según Decreto 2591?
- ¿Competencia del juzgado?

### Inventario documental

- Documentos recibidos (lista auto + manual)
- Documentos faltantes detectados

### Metadatos de extracción (solo lectura / debug)

- Confianza por campo
- Fragmento de evidencia (expandible)

---

## 6. Pestaña 2 — Conversación para decisión

### Comportamiento del asistente

1. **Inicia** con un mensaje estructurado:
   - Resumen del caso en 3–5 líneas
   - Requisitos formales: cumple / no cumple / duda
   - Procedencia sustancial (admitir, inadmitir, rechazar, remitir)
   - Bases legales sugeridas (solo desde biblioteca + contexto)
   - Nivel de confianza y qué falta por confirmar

2. **El abogado responde:** acuerda, pide más fundamento, cambia veredicto.

3. **Consenso:** botón "Generar borrador de respuesta".

### Paso final — Plantilla Word (al momento, no en biblioteca)

Tras confirmar el veredicto, el abogado **sube el formato vigente**:

- Plantilla Word oficial del despacho (`.docx` con placeholders), **o**
- Tutela ya respondida con veredicto similar (referencia de estilo)

El sistema **analiza el archivo on-the-fly** (mammoth + IA), mapea secciones y genera el borrador. **No se reutiliza una plantilla vieja de biblioteca** — cada generación usa el archivo que el abogado acaba de subir.

Opcional en v1.1: reutilizar plantilla de una tutela anterior del mismo despacho, siempre re-analizada.

Ver detalle en `PLAN_IA_Y_AGENTE.md` §5.

### Guardrails legales y éticos

- Disclaimer visible: *"Sugerencia de apoyo. La decisión es del abogado/juez."*
- Trazabilidad: qué documentos de biblioteca se usaron en cada respuesta.
- No afirmar jurisprudencia no cargada en biblioteca.

---

## 7. Biblioteca de documentos (módulo aparte)

Normas y referencias que el abogado carga y mantiene:

- Constitución Política
- Decreto 2591 de 1991
- Código General del Proceso (artículos aplicables)
- Código Civil, Código de Comercio (según materia)
- Sentencias o criterios del despacho

**Operaciones:** ver, editar texto, eliminar, importar PDF (OCR → texto editable).

**Qué NO va en biblioteca:** plantillas Word de respuesta ni tutelas resueltas como formato. Esas se suben al final del flujo de cada tutela (ver §6).

La biblioteca alimenta el RAG del chat de decisión.

---

## 8. Modelo mental: el juez impone el formato

En un juzgado real, el juez define cómo se redactan las respuestas. En el producto:

- **v1:** el abogado sube la plantilla Word del despacho o una tutela previa.
- **v2+:** perfiles por despacho/juez con plantillas y criterios guardados.

No modelamos todos los cargos (juez, oficial mayor, secretario, escribientes). Un solo rol operativo: **abogado del despacho**.

---

## 9. Métricas de éxito (v1 tutelas)

| Métrica | Objetivo |
|---------|----------|
| Campos críticos correctos tras revisión abogado | ≥ 90% |
| Tiempo desde carga PDF hasta borrador DOCX | ≤ 15 min (caso estándar) |
| Aceptación de sugerencia inicial de decisión | ≥ 70% (ajuste menor) |
| Formato DOCX usable sin reescritura total | ≥ 80% |

Campos críticos tutela: accionante, accionados, derechos invocados, pretensiones, hechos resumidos.

---

## 10. Lo que NO entra en v1

- Calificación de demandas civiles/ejecutivas
- Mapeo por cargo (secretario, escribiente, etc.)
- Checklist configurable por perfil (simplificado, fijo para tutela)
- Dashboard analítico avanzado
- Integración con sistemas de la Rama Judicial

---

## 11. Documentos relacionados

- `../DOCUMENTACION_PROYECTO.md` — referencia técnica consolidada
- `./ROADMAP_TUTELAS.md` — plan de implementación por fases
- `./PLAN_IA_Y_AGENTE.md` — decisiones de IA, agente y plantilla Word
- `./MATRIZ_EVALUACION_PRECISION_CASOS.md` — evaluación de calidad
