# Contexto base del proyecto

## Instrucción permanente

En cada nueva conversación, adjuntar este contexto (o confirmar que se mantiene como referencia) antes de solicitar generación de código.

## Naturaleza del sistema

Sistema interno de apoyo jurídico para calificación de demandas en juzgados civiles municipales de Colombia.

- No reemplaza la función jurisdiccional
- No usa APIs externas de IA en esta fase
- No implementa RLS en fase inicial

## Stack

- Frontend: Next.js (deploy en Vercel)
- Backend: Supabase (PostgreSQL + Auth)
- Arquitectura modular en `src/modules`

## Flujo funcional objetivo

1. Crear caso
2. Completar checklist procesal
3. Ejecutar motor de reglas
4. Mostrar decisión sugerida
5. Ajustar motivación
6. Generar documento editable
7. Guardar decisión final