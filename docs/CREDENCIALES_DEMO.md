# Usuario de prueba — Tutelas

## Credenciales

| Campo | Valor |
|-------|-------|
| **Email** | `demo.tutelas@despacho.test` |
| **Contraseña** | `DemoTutela2026!` |

Solo para entornos de prueba y demos. **No usar en producción real** con datos sensibles.

## Crear o resetear el usuario

El script lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` desde `.env` o `.env.local`.

```bash
npm run seed:demo-user
```

Requiere en el entorno:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Probar Gemini API

Con `GEMINI_API_KEY` configurada:

```bash
node scripts/test-gemini.mjs
```

O en el navegador (con la app corriendo):

```
GET /api/llm/test
GET /api/llm/status
```

## Variables Vercel (producción)

| Variable | Valor recomendado |
|----------|-------------------|
| `LEGAL_LLM_ENABLED` | `true` |
| `LEGAL_LLM_PROVIDER` | `router` |
| `LEGAL_LLM_EXTRACT_PROVIDER` | `gemini` |
| `LEGAL_LLM_EXTRACT_MODEL` | `gemini-3.6-flash` |
| `LEGAL_LLM_ALLOW_OLLAMA_FALLBACK` | `false` |
| `GEMINI_API_KEY` | Tu key de Google AI Studio |

**Nota:** La key de Google AI Studio suele empezar por `AIzaSy`. Si tu key tiene otro formato, verifica en [Google AI Studio](https://aistudio.google.com/apikey).
