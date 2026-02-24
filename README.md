# Sistema Interno de Apoyo Jurídico

Herramienta interna para apoyar la calificación rápida de demandas civiles municipales en Colombia, basada en reglas configurables del CGP.

## Alcance actual

- Autenticación con Supabase Auth y protección de rutas privadas.
- CRUD básico de casos (`cases`) y checklist procesal (`case_requirements_check`).
- Motor de reglas desacoplado con condiciones JSON en `rule_definitions`.
- Sugerencia de decisión con fundamento y motivación editable.
- Generación de documento final en plantilla institucional.
- Descarga DOCX bajo demanda (sin almacenamiento de archivo generado).

## Stack

- Next.js + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Sin RLS en esta fase

## Inicio rápido

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables de entorno en `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Ejecutar SQL en Supabase (en orden):

- `supabase/schema.sql`
- `sql/migrations/20260220_002_seed_legal_articles_and_rules.sql`

4. Ejecutar en local:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Referencias

- `DOCUMENTACION_PROYECTO.md`
- `docs/CONTEXTO-PROYECTO.md`
- `docs/IMPLEMENTACION_COMPLETA_APP.md`
- `docs/ASISTENTE_OFFLINE_MVP.md`
- `sql/README.md`