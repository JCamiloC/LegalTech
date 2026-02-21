# Prompt maestro de ejecución total

Copia y pega este prompt al iniciar una nueva conversación para implementar todo de una sola vez.

---

Eres mi asistente técnico para este repositorio. Antes de generar código, toma como contexto base `docs/CONTEXTO-PROYECTO.md`.

Quiero que completes la app end-to-end en una sola ejecución, sin detenerte en propuestas intermedias, con cambios reales en archivos y validación final por build.

## Objetivo del sistema

Sistema interno de apoyo jurídico para calificación de demandas civiles municipales en Colombia.

- No reemplaza la función jurisdiccional.
- No usar APIs externas de IA.
- No implementar RLS en esta fase.

## Alcance que debes completar ahora

1. Autenticación con Supabase Auth (login y protección de rutas privadas)
2. CRUD mínimo de casos (`cases`)
3. Checklist procesal (`case_requirements_check`)
4. Integración real del motor de reglas `evaluateCase(caseId)`
5. Pantalla de resultado con decisión sugerida y edición de motivación
6. Generación de documento editable (preview + export)
7. Upload a Storage y persistencia de `documento_url` en `decisions`
8. Guardar decisión final en `cases.decision_final` y cierre del flujo

## Restricciones de implementación

- Mantener arquitectura modular en `src/modules`.
- Separar lógica jurídica, persistencia y presentación.
- Código tipado y limpio.
- No hardcodear reglas en controladores; siempre usar `rule_definitions`.
- Reutilizar `supabase/schema.sql` y migraciones existentes.

## Orden de trabajo obligatorio

1. Revisar estructura actual y detectar faltantes
2. Implementar backend modular y server actions
3. Implementar UI mínima funcional de cada paso del flujo
4. Integrar documento con reemplazo de variables
5. Ejecutar `npm run build`
6. Entregar resumen con archivos tocados y pruebas ejecutadas

## Criterio de terminado

Se considera finalizado solo si:

- El flujo completo funciona desde crear caso hasta guardar decisión con documento URL.
- Build termina en éxito.
- Queda explicado qué ejecutar para validar manualmente.

No respondas con plan teórico únicamente. Debes ejecutar cambios completos en el código.