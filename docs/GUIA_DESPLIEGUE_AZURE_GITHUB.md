# Guía completa: desplegar LegalTech desde GitHub hacia Azure

Esta guía te permite desplegar tu repo en Azure sin Vercel, manteniendo Supabase como backend.

---

## 1) Resumen de arquitectura recomendada

### Opción recomendada para tu MVP (rápida y estable)

- **Frontend + backend Next.js**: Azure App Service (Linux, Node 20)
- **Código fuente**: GitHub (`main`)
- **Base de datos/Auth**: Supabase (se mantiene igual)
- **CI/CD**: GitHub Actions (deploy automático al hacer push)

### ¿Debo salir de Supabase?

No necesariamente.

- Si mantienes Supabase cloud, tu app funciona bien en Azure.
- Solo cambiarías el hosting de la app (de Vercel a Azure).
- Si en el futuro quieres modo 100% offline (sin internet), ahí sí debes migrar también BD/Auth/Storage a infraestructura propia.

---

## 2) ¿Tendré dominio de prueba en Azure?

Sí, Azure entrega dominio por defecto sin costo adicional.

- **Azure App Service**: `https://<nombre-app>.azurewebsites.net`
- **Azure Container Apps** (si luego migras a contenedores): `https://<nombre-app>.<hash>.<region>.azurecontainerapps.io`

Con esto ya tienes un dominio de prueba público para QA/UAT.

### También puedes usar un subdominio de prueba propio

Ejemplo: `qa.tudominio.com`

- Creas `CNAME` en tu DNS apuntando al host de Azure.
- Lo agregas en `Custom domains` del recurso Azure.
- Activas TLS/SSL administrado por Azure.

---

## 3) Prerrequisitos

1. Cuenta Azure con permisos de crear recursos.
2. Repo en GitHub (este proyecto).
3. Variables de entorno de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Node.js local (v20 recomendado) para pruebas previas.
5. App compilando sin errores:

```bash
npm install
npm run build
```

---

## 4) Crear recursos en Azure (Portal)

## 4.1 Resource Group

1. Azure Portal → `Resource groups` → `Create`
2. Nombre sugerido: `rg-legaltech-prod`
3. Región sugerida: la más cercana a tus usuarios

## 4.2 App Service Plan

1. `App Services` → `Create`
2. Publica: `Code`
3. Runtime: `Node 20 LTS`
4. OS: `Linux`
5. Región: misma del Resource Group
6. Pricing tier (MVP): `B1` o `S1`

## 4.3 Web App

1. Nombre de app (único global): `legaltech-app-<sufijo>`
2. Al crearla tendrás URL:
   - `https://legaltech-app-<sufijo>.azurewebsites.net`

---

## 5) Configurar variables de entorno en Azure

En tu Web App:

1. `Settings` → `Environment variables`
2. Agrega:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=production`

3. Guardar y reiniciar app.

Nota: nunca pongas secretos en el código; siempre en variables de entorno.

---

## 6) Configurar despliegue continuo desde GitHub

Hay 2 formas. Recomiendo **GitHub Actions**.

## 6.1 Opción A (recomendada): Deployment Center + GitHub Actions

1. Web App → `Deployment Center`
2. Source: `GitHub`
3. Autoriza GitHub
4. Selecciona:
   - Organization: tu org/usuario
   - Repository: `LegalTech`
   - Branch: `main`
5. Guarda

Azure creará un workflow en tu repo (`.github/workflows/...`).

## 6.2 Validar workflow

En GitHub Actions, verifica que:

- se ejecuta `npm install`
- se ejecuta `npm run build`
- despliega exitosamente

Si falla por build, corrige y vuelve a hacer push.

---

## 7) Configuración de startup para Next.js en App Service

Normalmente Azure detecta Next.js y ejecuta `npm start`.

Asegúrate de tener en `package.json`:

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

Si necesitas fijar comando de inicio:

- Web App → `Configuration` → `General settings` → `Startup Command`
- Usa: `npm start`

---

## 8) Checklist de salida a producción

Antes de publicar:

1. Build local en éxito.
2. Variables de entorno cargadas en Azure.
3. Login funciona (`/login`).
4. Flujo de casos funciona (`/casos`, `/casos/nuevo`, `/casos/[id]`).
5. Reglas y plantillas funcionan (`/reglas`, `/plantillas`).
6. Descarga DOCX funciona (`/documentos/descargar?...`).
7. Asistente offline funciona (`/asistente`).

---

## 9) Dominio de prueba y dominio final

## 9.1 Dominio de prueba inmediato

Usa el dominio nativo:

- `https://<tu-app>.azurewebsites.net`

No requiere DNS adicional.

## 9.2 Dominio propio (QA)

Ejemplo: `qa.legaltech.midominio.com`

1. En tu proveedor DNS crea `CNAME`:
   - `qa.legaltech` -> `<tu-app>.azurewebsites.net`
2. En Azure Web App:
   - `Custom domains` → `Add custom domain`
3. Valida propiedad y agrega certificado TLS administrado.

## 9.3 Dominio final (producción)

Repite el proceso con `app.midominio.com` o dominio principal.

---

## 10) Seguridad mínima recomendada

1. Habilitar HTTPS only en Web App.
2. Desactivar logs con datos sensibles.
3. Activar Application Insights (telemetría técnica, no datos jurídicos sensibles).
4. Rotar claves de Supabase periódicamente.
5. Configurar alertas de disponibilidad y error rate.

---

## 11) Costos y escalamiento (MVP)

- Inicia en `B1`/`S1` para validar carga.
- Escala vertical cuando haya más concurrencia.
- Usa slots (`staging`/`production`) cuando quieras despliegues con menor riesgo.

---

## 12) Troubleshooting rápido

## 12.0 Error típico: `Application Error` + `503`

Este error casi siempre es fallo de arranque en App Service.

### Checklist de recuperación en 10 minutos

1. En Azure Web App → `Configuration`:
    - `WEBSITE_NODE_DEFAULT_VERSION` = `~20`
    - `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
    - `NODE_ENV` = `production`
2. Verifica variables de Supabase (las 3 obligatorias).
3. En `General settings` deja startup command vacío, o usa `npm start`.
4. Reinicia la Web App.
5. Revisa `Log stream` y confirma que arranca Next.js en el puerto asignado por `PORT`.

### Señales en logs y corrección

- `Could not find a production build in the '.next' directory`
   - El build no corrió en deploy. Activa `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.
- `next: not found` o `next no se reconoce`
   - Dependencias incompletas o startup incorrecto. Usa `npm start` y verifica instalación.
- `Node version not supported`
   - Fija Node 20 en App Service (`WEBSITE_NODE_DEFAULT_VERSION=~20`).
- `Conflict (CODE: 409)` en `azure/webapps-deploy`
   - Hay un deploy en curso o colgado en Kudu/OneDeploy.
   - En Azure Portal abre tu Web App -> `Deployment Center` y verifica estado.
   - Si hay despliegue trabado, reinicia la Web App y vuelve a ejecutar el workflow.
   - Evita pushes simultáneos a `main` (el workflow ya tiene control de concurrencia).

Con esta base, el 503 suele resolverse sin cambios adicionales.

## Error: pantalla en blanco o 500

- Revisa `Log stream` en Azure App Service.
- Verifica variables de entorno faltantes.
- Verifica que `npm run build` funciona localmente.

## Error de Supabase en producción

- Valida URL y keys.
- Verifica políticas/estructura de tablas en Supabase.

## Error en rutas privadas

- Verifica `proxy.ts` y cookies de sesión.
- Revisa que la URL pública coincida con configuración de Auth en Supabase (redirect URLs).

---

## 13) Roadmap recomendado después del primer deploy

1. Crear slot `staging`.
2. Agregar CI con tests mínimos antes de deploy.
3. Integrar Key Vault para secretos.
4. Definir estrategia de LLM (Azure OpenAI o modelo local) con feature flag.
5. Evaluar migración a arquitectura containerizada (Azure Container Apps) si crece el tráfico.

---

## 14) Comandos útiles locales

```bash
npm install
npm run build
npm run start
```

Para probar en local modo producción:

```bash
npm run build
npm run start
```

---

## 15) Decisión recomendada para tu caso actual

- **Sí**: mover app de Vercel a Azure App Service.
- **Sí**: mantener Supabase inicialmente para acelerar salida.
- **Sí**: usar dominio `azurewebsites.net` como entorno de prueba.
- **Después**: configurar dominio propio QA + TLS.

Con esto puedes dejar la app desplegada rápido, estable y con camino claro hacia una futura arquitectura con LLM y memoria.
