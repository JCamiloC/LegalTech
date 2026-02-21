# Sistema Interno de Apoyo Jurídico

Herramienta interna para apoyo técnico en la calificación de demandas en juzgados civiles municipales de Colombia.

## Alcance

- Registro de demandas (`cases`)
- Checklist de requisitos procesales (`case_requirements_check`)
- Motor de reglas desacoplado para sugerencia de decisión
- Generación de documento editable desde plantilla
- Persistencia en Supabase (PostgreSQL + Auth + Storage)

## Stack

- Next.js + TypeScript + Tailwind CSS
- Supabase (sin RLS en fase inicial)
- Deploy objetivo: Vercel

## Inicio rápido

1. Instalar dependencias:

```bash
npm install
```

2. Ejecutar migraciones SQL en Supabase (en orden):

- `sql/migrations/20260220_001_init_juridico.sql`
- `sql/migrations/20260220_002_seed_legal_articles_and_rules.sql`

3. Levantar entorno local:

```bash
npm run dev
```

## Referencias

- Arquitectura y decisiones: `DOCUMENTACION_PROYECTO.md`
- Resumen de SQL: `sql/README.md`
- Contexto base para futuras conversaciones: `docs/CONTEXTO-PROYECTO.md`
npm run dev          # Iniciar servidor de desarrollo

# Producción
npm run build        # Construir para producción
npm run start        # Iniciar servidor de producción

# Calidad de código
npm run lint         # Ejecutar ESLint
```

---

## 🚦 Roadmap de Desarrollo

### ✅ Pre-Sprint (Semana 0)
- Migración de plantilla crmozono → Arajet
- Actualización de branding

### 🔄 Sprint 0 (Semanas 1-2) - En progreso
- Configuración de base de datos
- Setup de servicios
- Generación de tipos

### 📅 Sprint 1-5 (Semanas 3-12)
- Sprint 1: Usuarios y Dashboard
- Sprint 2: CRUD de Auditorías
- Sprint 3: Módulos relacionados
- Sprint 4: Generación de PDF
- Sprint 5: Testing y Deploy

📖 **Roadmap completo:** [docs/auditoria/05-roadmap-implementacion.md](docs/auditoria/05-roadmap-implementacion.md)

---

## 🔐 Roles y Permisos

El sistema implementa 4 roles con permisos granulares:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **Admin** | Administrador | Acceso total al sistema |
| **Auditor Líder** | Líder de equipo | Crear/editar auditorías asignadas |
| **Auditor** | Ejecutor | Completar formularios y criterios |
| **Visualizador** | Solo lectura | Ver auditorías asignadas |

📖 **Detalle completo:** [docs/auditoria/03-roles-permisos.md](docs/auditoria/03-roles-permisos.md)

---

## 🌐 Deployment

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Variables de entorno requeridas en Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Configuración Automática

1. Push a GitHub
2. Importar proyecto en [vercel.com](https://vercel.com)
3. Configurar variables de entorno
4. Deploy automático en cada push

---

## 🐛 Troubleshooting

### Error: "Supabase client not initialized"
**Solución:** Verificar que `.env` tenga las variables correctas.

### Error: "permission denied for table"
**Solución:** Verificar que las políticas RLS estén correctamente configuradas ejecutando `rls.sql`.

### Páginas no cargan después de login
**Solución:** Verificar que el middleware de autenticación esté configurado correctamente.

### PDF generation fails
**Solución:** Verificar que Puppeteer tenga las dependencias del sistema instaladas.

---

## 📞 Soporte

- **Documentación:** `docs/auditoria/`
- **Guía de Migración:** `docs/auditoria/00-migracion-plantilla.md`
- **Roadmap:** `docs/auditoria/05-roadmap-implementacion.md`
- **SQL Setup:** `sql/auditoria/README.md`

---

## 📜 Licencia

Propietario: **Arajet**

---

## 🙏 Créditos

- **Plantilla base:** [crmozono](https://github.com/JCamiloC/crmozono) by JCamiloC
- **Adaptado para:** Sistema de Gestión de Auditorías - Arajet
- **Arquitectura:** Next.js 14 + Supabase (100% Serverless)

---

**Versión:** 1.0.0  
**Última actualización:** Febrero 2026  
**Estado:** Pre-Sprint (Migración de plantilla en progreso)