# Asistente Offline MVP

## Objetivo

Proveer orientación experta dentro de la app sin APIs externas, usando:

- Reglas activas (`rule_definitions`)
- Artículos legales (`legal_articles`)
- Contexto del caso y checklist

## Componentes implementados

- Servicio local: `src/modules/expert/expert-assistant.service.ts`
- Pantalla de consulta: `app/asistente/page.tsx`
- Protección de ruta privada: `proxy.ts`
- Accesos rápidos desde casos y detalle de caso

## Cómo funciona

1. Usuario formula una pregunta (y opcionalmente envía `caseId`).
2. Servicio tokeniza consulta y busca coincidencias en reglas y artículos.
3. Si hay `caseId`, analiza estado del caso y checklist para recomendaciones operativas.
4. Devuelve respuesta estructurada con:
   - Resumen
   - Recomendaciones
   - Reglas relevantes
   - Artículos relevantes
   - Campos sugeridos a revisar
   - Siguiente paso sugerido

## Límites del MVP

- No aprende todavía del histórico automáticamente.
- No usa embeddings ni modelos generativos locales en esta fase.
- Funciona como asistente determinístico guiado por datos del proyecto.

## Evolución recomendada

### Fase 1 (actual)
Asistente offline determinístico con reglas + artículos + checklist.

### Fase 2
Indexador semántico local (embeddings offline) para precedentes y similitud de casos.

### Fase 3
Modelo local supervisado para sugerencia probabilística de decisión (no vinculante).

### Fase 4
Modo híbrido controlado (consulta externa anonimizada solo para investigación jurisprudencial pública).
