# Matriz de evaluación de precisión — Tutelas

Plantilla para medir calidad del flujo tutela v1 por expediente y por campo crítico.

## 1) Reglas de calificación

- Puntaje por campo:
  - **2** = correcto y con evidencia válida en el PDF
  - **1** = parcialmente correcto o evidencia débil
  - **0** = incorrecto o no extraído
- Umbral por campo crítico: **≥ 1.8**
- Umbral por caso (promedio): **≥ 1.6**
- Semáforo: verde ≥ umbral | ámbar 1.3–umbral | rojo < 1.3

## 2) Campos críticos (tutela)

- radicado
- accionante_nombre
- accionados (al menos uno correcto)
- derechos_invocados
- pretensiones
- hechos_resumen

## 3) Plantilla por tutela

| tutela_id | accionante_ok (0-2) | accionados_ok (0-2) | derechos_ok (0-2) | pretensiones_ok (0-2) | hechos_ok (0-2) | checklist_ok (0-2) | decision_chat_ok (0-2) | docx_ok (0-2) | tiempo_min | observaciones |
|-----------|---------------------|---------------------|-------------------|----------------------|-----------------|--------------------|-----------------------|---------------|------------|---------------|
| T-001 | | | | | | | | | | |
| T-002 | | | | | | | | | | |
| T-003 | | | | | | | | | | |
| T-004 | | | | | | | | | | |
| T-005 | | | | | | | | | | |

## 4) Evaluación del chat de decisión

Por cada tutela, después del consenso:

| Criterio | Sí / No / Parcial | Notas |
|----------|-------------------|-------|
| ¿El análisis inicial identificó bien los hechos? | | |
| ¿Las bases legales citadas existen en biblioteca? | | |
| ¿El veredicto sugerido fue útil como punto de partida? | | |
| ¿Cuántos turnos de chat hasta consenso? | | |
| ¿El abogado cambió el veredicto sugerido? | | |

## 5) Evaluación del borrador Word

| Criterio | Sí / No / Parcial |
|----------|-------------------|
| ¿Respeta formato del juzgado? | |
| ¿Consideraciones jurídicamente coherentes? | |
| ¿Resuelve acorde al veredicto consensuado? | |
| ¿Edición manual ≤ 20% del texto? | |

## 6) Meta v1

- Campos críticos ≥ 90% correctos tras revisión abogado
- Decisión inicial aceptada con ajuste menor ≥ 70%
- DOCX usable ≥ 80%

Ver `VISION_TUTELAS.md` §9 y `ROADMAP_TUTELAS.md` Fase 5.
