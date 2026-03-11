# DOCUMENTACION MAESTRA - REINICIO MVP LEGALTECH

Este documento redefine el proyecto para enfocarlo en un MVP funcional, estable y usable por una abogada de pruebas, sin depender de IA en la fase actual.

## 1) Objetivo del producto

Entregar un sistema de apoyo juridico que minimiza el trabajo manual de la abogada en tres puntos clave:

1. **Extraccion automatica desde PDF:** el LLM lee la demanda y rellena el formulario del caso, sin importar el formato del abogado que la envio.
2. **Sugerencia de decision juridica:** el LLM analiza el caso con checklist + reglas + historico y propone la decision con fundamento normativo.
3. **Generacion de DOCX:** el sistema genera el documento de respuesta listo para revision y firma.

La decision final siempre la toma la abogada.

### Flujo completo:

```
PDF demanda -> LLM extrae campos -> Formulario prellenado -> Checklist
-> LLM sugiere decision -> Abogada confirma -> DOCX generado
```

---

## 2) Core del aplicativo (lo que SI se usa)

- Autenticacion y rutas privadas.
- Gestion de casos (`/casos`).
- **Ingesta de PDF con extraccion LLM** (reemplaza regex).
- Checklist procesal.
- **Sugerencia de decision por LLM** + reglas + historico.
- Plantillas por tipo de decision.
- Generacion y descarga de DOCX final.
- Auditoria de eventos del caso.

**Stack IA local:**
- Runtime: Ollama (gratuito, open-source).
- Modelo: `qwen2.5:14b-instruct-q4_K_M` (o `7b` en maquinas con menos RAM).
- Un modelo, dos prompts especializados (extraccion y analisis).
- Costo total: $0. Solo electricidad local.

---

## 3) Estrategia IA: un modelo, dos prompts

No se usan dos modelos separados. Eso duplicaria el consumo de RAM.

- **Prompt 1 — Extraccion:** recibe texto OCR del PDF, devuelve campos estructurados del caso en JSON.
- **Prompt 2 — Analisis:** recibe datos del caso + checklist + reglas + historico, devuelve decision sugerida con fundamento.

El mismo modelo Qwen 2.5 cubre ambas tareas con calidad suficiente para este dominio.

---

## 4) Arquitectura tecnica

### Extraccion desde PDF (Sprint 1)

```
PDF -> OCR (pdf-parse, ya existe) -> texto crudo
    -> LlmExtractionService (Ollama) -> JSON validado
    -> Formulario prellenado con indicador de confianza por campo
    -> Fallback a regex si LLM no disponible
```

### Sugerencia de decision (Sprint 2)

```
Caso guardado + checklist completado
    -> LlmDecisionService (Ollama)
       + reglas activas
       + hasta 10 casos historicos similares
    -> Decision sugerida + fundamento normativo + confianza
    -> Abogada confirma o ajusta
    -> Se guarda decision final + registro de si la IA acierto
```

### Aprendizaje incremental

- Cada decision final queda almacenada.
- El historico alimenta el contexto del siguiente caso.
- No se necesita vector DB ni embeddings para el MVP.
- Simple recuperacion por tipo_proceso + resultado.

---

## 5) Paso a paso de ejecucion (Sprints)

**Sprint 0 (1 dia):** instalar Ollama + descargar modelo + configurar variables.

**Sprint 1 (3-4 dias):** LLM extrae campos desde demanda PDF.

**Sprint 2 (3-4 dias):** LLM sugiere decision juridica con fundamento.

**Sprint 3 (2-3 dias):** plantillas DOCX con todos los campos nuevos.

**Sprint 4 (2 dias):** historico, metricas de precision, casos similares.

Detalle completo: `docs/PLAN_REINICIO_MVP_LOCAL.md`

---

## 6) Costos

| Componente | Costo |
|---|---|
| Ollama (runtime LLM) | $0 — open source |
| Qwen 2.5 (modelo) | $0 — open weights |
| Maquina local de pruebas | $0 — hardware propio |
| Supabase free tier | $0 hasta 500MB |
| **MVP local total** | **$0** |

Si en el futuro se despliega en nube: Azure VM Standard_D4s_v5 ~$150 USD/mes.

---

## 7) Despliegue

- MVP: local en maquina de la abogada (Ollama + Next.js dev build).
- No requiere cloud para funcionar.
- Cloud se evalua al estabilizar el producto.

---

## 8) Criterio de exito del MVP

1. Cargar una demanda PDF y ver el formulario prellenado en menos de 30 segundos.
2. El sistema sugiere la decision juridica con fundamento normativo.
3. La abogada solo ajusta detalles, no rellena todo desde cero.
4. El DOCX generado no requiere correcciones manuales de datos.

---

## 9) Regla de documentacion

Este archivo es la unica fuente oficial vigente.
Detalle de sprints e implementacion: `docs/PLAN_REINICIO_MVP_LOCAL.md`
