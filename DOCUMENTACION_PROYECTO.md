# DOCUMENTACION DEL PROYECTO

## 1) Propósito

Sistema interno de apoyo técnico para la calificación de demandas en juzgados civiles municipales de Colombia. No reemplaza la función jurisdiccional.

## 2) Arquitectura

Arquitectura modular en Next.js + Supabase:

```text
app/                        -> Presentación (App Router)
src/modules/cases           -> Registro y consulta de demandas
src/modules/rules           -> Motor de reglas desacoplado
src/modules/decisions       -> Persistencia de decisiones
src/modules/documents       -> Plantillas y exportación
src/modules/legal           -> Catálogo de artículos del CGP
src/lib/supabase            -> Clientes Supabase (browser/server/admin)
src/types                   -> Contratos tipados del dominio
sql/migrations              -> Migraciones SQL versionadas
```

Separación aplicada:

- Lógica jurídica: `src/modules/rules`
- Persistencia: repositorios en `src/modules/*/*.repository.ts`
- Presentación: rutas en `app/`

## 3) Modelo ER (fase inicial)

Entidades principales:

- `cases` (1) -> (N) `case_requirements_check`
- `cases` (1) -> (N) `decisions`
- `legal_articles` (catálogo)
- `rule_definitions` (reglas activas por prioridad)

Reglas de negocio clave:

- `cases.estado` inicia en `pendiente`
- `cases.decision_sugerida` se llena al ejecutar motor de reglas
- `cases.decision_final` se llena tras validación humana
- `decisions.documento_url` guarda la ubicación del archivo generado

## 4) Motor de reglas

Contrato principal:

```ts
evaluateCase(caseId: string): Promise<DecisionSuggestion>
```

Flujo:

1. Carga caso (`cases`) y checklist (`case_requirements_check`)
2. Carga reglas activas (`rule_definitions`) ordenadas por `prioridad`
3. Evalúa `condicion_json` con operadores lógicos/comparativos
4. Retorna:
   - `tipoDecision`
   - `fundamento`
   - `explicacion` estructurada (resumen + reglas evaluadas)

Diseño escalable:

- Sin lógica hardcodeada en controladores
- Reglas configurables desde base de datos
- Operadores soportados: `and`, `or`, `not`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `is_true`, `is_false`

## 5) Módulo de documentos

Objetivo:

- Renderizar plantillas base (`HTML` inicialmente; extensible a `DOCX`)
- Reemplazar variables:
  - `{{radicado}}`
  - `{{demandante}}`
  - `{{demandado}}`
  - `{{fundamento}}`
  - `{{decision}}`
- Proveer vista previa antes de exportar
- Persistir URL del documento en `decisions.documento_url`

## 6) Flujo funcional implementado como base

1. Crear caso
2. Completar checklist
3. Ejecutar motor de reglas
4. Mostrar decisión sugerida
5. Ajustar motivación por operador jurídico
6. Generar documento editable
7. Guardar decisión final

## 7) Instrucciones de ampliación futura

- Fase 2: habilitar seguridad por roles y políticas RLS
- Agregar trazabilidad de auditoría de cambios
- Incorporar editor rico para motivación y fundamentos
- Migrar plantilla HTML a DOCX con `docx` o `docxtemplater`
- Publicar endpoints internos para integración con sistemas judiciales

## 8) Posibles mejoras (IA supervisada futura)

- Clasificación asistida de tipo/subtipo de proceso
- Sugerencia de fundamento jurídico como borrador editable
- Detección de inconsistencias en checklist

Principio rector: la IA solo sugiere; la decisión final siempre es humana.