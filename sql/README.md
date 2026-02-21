# SQL del sistema jurídico

Ejecutar migraciones manualmente en Supabase SQL Editor en este orden:

1. `migrations/20260220_001_init_juridico.sql`
2. `migrations/20260220_002_seed_legal_articles_and_rules.sql`

Notas:

- En fase inicial no se crean políticas RLS.
- Las reglas se almacenan en `rule_definitions` para escalabilidad del motor.
