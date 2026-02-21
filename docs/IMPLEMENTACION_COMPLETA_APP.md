# Implementación completa de la app (end-to-end)

## 1. Objetivo

Completar el sistema interno de apoyo jurídico desde base de datos, autenticación, flujo de casos, motor de reglas y generación de documento editable.

## 2. Alcance funcional obligatorio

1. Crear caso
2. Completar checklist procesal
3. Ejecutar motor de reglas
4. Mostrar decisión sugerida
5. Permitir edición de motivación
6. Generar documento editable
7. Guardar decisión final y URL del documento

## 3. Base de datos (Supabase)

### 3.1 Script principal

Ejecutar en SQL Editor:

- `supabase/schema.sql`

Contiene:

- Tipos: `decision_type`, `case_status`, `app_role`
- Tablas: `profiles`, `cases`, `case_requirements_check`, `decisions`, `legal_articles`, `rule_definitions`, `document_templates`
- Triggers de `updated_at`
- Trigger de sincronización `auth.users -> profiles`
- Bucket privado `decision-documents`

### 3.2 Seeds iniciales

Ejecutar luego:

- `sql/migrations/20260220_002_seed_legal_articles_and_rules.sql`

### 3.3 Validaciones mínimas SQL

Ejecutar y validar que retorne datos:

```sql
select count(*) from public.rule_definitions where activo = true;
select count(*) from public.legal_articles;
select * from storage.buckets where id = 'decision-documents';
```

## 4. Variables de entorno

Requeridas en `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 5. Autenticación (fase inicial sin RLS)

### 5.1 Flujo de Auth

- Login por correo y contraseña con Supabase Auth
- Al crear usuario, trigger crea/actualiza `profiles`
- Sesión gestionada con cliente SSR en server/browser

### 5.2 Rutas sugeridas

- `/login`
- `/logout`
- `/casos`
- `/casos/nuevo`
- `/casos/[id]`
- `/documentos/preview`

### 5.3 Control de acceso mínimo

- `proxy.ts` verifica sesión para rutas privadas
- Sin RLS por ahora
- Restricciones por rol se hacen en capa app usando `profiles.role`

## 6. Implementación por módulos

### 6.1 Módulo `cases`

Responsable de:

- Crear/actualizar casos en `cases`
- Crear checklist en `case_requirements_check`
- Consultar estado y datos para evaluación

### 6.2 Módulo `rules`

Contrato:

```ts
evaluateCase(caseId: string): Promise<DecisionSuggestion>
```

Reglas:

- Cargar reglas activas por prioridad
- Evaluar `condicion_json`
- Retornar `tipoDecision`, `fundamento`, `explicacion`

### 6.3 Módulo `decisions`

Responsable de:

- Guardar decisión sugerida/final
- Persistir `fundamento_juridico`, `motivacion`, `articulos_aplicados`
- Asociar `documento_url`

### 6.4 Módulo `documents`

Responsable de:

- Cargar plantilla (`document_templates`)
- Reemplazar variables:
  - `{{radicado}}`
  - `{{demandante}}`
  - `{{demandado}}`
  - `{{fundamento}}`
  - `{{decision}}`
- Mostrar preview
- Exportar HTML/DOCX
- Subir a Storage bucket `decision-documents`

## 7. Flujo técnico completo (request lifecycle)

1. Usuario autenticado crea caso
2. Sistema guarda registro en `cases`
3. Usuario completa checklist
4. Sistema guarda en `case_requirements_check`
5. Usuario ejecuta evaluación
6. `evaluateCase(caseId)` procesa reglas
7. Sistema muestra sugerencia editable
8. Usuario ajusta motivación
9. Sistema renderiza documento y preview
10. Sistema exporta/sube documento a Storage
11. Sistema guarda decisión en `decisions` con `documento_url`
12. Sistema actualiza `cases.decision_final` y `cases.estado='decidido'`

## 8. Server Actions recomendadas

- `createCaseAction(input)`
- `saveChecklistAction(caseId, checklist)`
- `evaluateCaseAction(caseId)`
- `saveDecisionAction(caseId, payload)`
- `generateDecisionDocumentAction(decisionId)`

Todas deben:

- Validar entrada
- Invocar servicios modulares
- Manejar errores con mensajes funcionales

## 9. Criterios de aceptación

La app está completa cuando:

- Se puede autenticar un usuario
- Se puede crear caso y checklist
- `evaluateCase` devuelve una sugerencia consistente
- Se puede editar motivación y guardar decisión
- Se genera documento y queda URL persistida
- Build en Next.js compila sin errores

## 10. Plan de ejecución sugerido en una sola corrida

1. SQL + seeds
2. Auth + rutas protegidas
3. Formulario crear caso
4. Formulario checklist
5. Integrar `evaluateCase`
6. Pantalla de resultado editable
7. Preview/exportación y upload a storage
8. Guardado final de `decisions`
9. Pruebas funcionales end-to-end

## 11. Riesgos y mitigación

- Regla mal configurada en JSON: agregar validación de estructura
- Documento sin plantilla activa: fallback a plantilla por defecto
- Fallo en upload de storage: mantener preview local y reintento
- Inconsistencias de estado del caso: transacción para guardado final

## 12. Fase posterior

- Habilitar RLS por roles
- Historial detallado de cambios
- Plantillas DOCX avanzadas
- Integración de IA supervisada como asistencia no vinculante