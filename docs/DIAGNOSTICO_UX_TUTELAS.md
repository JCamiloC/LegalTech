# Diagnóstico UX — Asistente de tutelas

Análisis para presentar a abogados y priorizar mejoras antes de producción.

**Fecha:** septiembre 2026  
**Estado UI:** Fase 1 simplificada implementada

---

## 1. Diagnóstico general

### Lo que funciona bien

- **Flujo de 2 pasos** (Contexto → Decisión) es el modelo correcto. Los abogados piensan en fases, no en módulos técnicos.
- **Formulario editable post-extracción** genera confianza: el abogado ve que la IA asiste, no impone.
- **Biblioteca separada** evita mezclar normas con plantillas de respuesta.

### Problemas detectados (antes de simplificar)

| Problema | Impacto | Severidad |
|----------|---------|-----------|
| 10+ rutas en menú (casos, flujos, recursos, reglas…) | Parálisis de elección | Crítica |
| Terminología civil (demanda, demandante) | Desconexión con tutelas | Alta |
| Pantalla de flujos intermedia post-login | Fricción innecesaria | Alta |
| Indicador IA mostraba Ollama desconectado en Vercel | Pánico / desconfianza | Alta |
| Vista detalle con 15 formularios | Abrumador | Alta |
| Sin progreso visible | No saben dónde están | Media |

### Estado tras simplificación (ahora)

- Login → **Mis tutelas** directo
- Nav: **Mis tutelas | Biblioteca | Salir**
- Rutas legacy redirigen a tutelas o biblioteca
- Stepper visual en nueva tutela (1 Contexto → 2 Decisión)
- IA status muestra proveedor cloud (Gemini)

---

## 2. ¿Steppers, tutoriales o onboarding?

### Recomendación: **stepper sí, tutorial no (v1)**

| Mecanismo | ¿Implementar? | Razón |
|-----------|---------------|-------|
| **Stepper horizontal (2 pasos)** | ✅ Sí | Ya implementado. Suficiente para v1. |
| **Tour guiado (Joyride, etc.)** | ❌ No en v1 | Añade código y mantenimiento; los abogados lo saltan. |
| **Video tutorial** | ❌ No | Overkill para MVP demo. |
| **Empty states con CTA** | ✅ Sí | "Aún no tienes tutelas → Crear primera" (implementado). |
| **Microcopy contextual** | ✅ Sí | Textos bajo campos ámbar, bajo upload PDF (implementado). |
| **Checklist de primer uso** | ⚠️ v1.1 | "1. Carga normas en biblioteca 2. Crea tutela" — útil post-demo. |

### Por qué NO un tutorial interactivo largo

- Abogados de despacho tienen poco tiempo; prefieren **hacer una tutela real** a ver slides.
- El producto tiene **2 pasos** — un stepper + empty states comunican el flujo sin interrumpir.
- Los tutoriales en software jurídico se sienten "capacitación obligatoria".

### Stepper recomendado (definitivo)

```
[ 1. Cargar y revisar ] ──→ [ 2. Decidir y redactar ] ──→ [ ✓ Borrador ]
         ↑ activo                  pendiente                  futuro
```

En paso 2, añadir sub-stepper interno (v1.1):

```
Chat → Confirmar veredicto → Subir plantilla → Descargar Word
```

---

## 3. Flujo ideal para abogados (target UX)

```
Login
  ↓
Mis tutelas ──[+ Nueva tutela]──→ Paso 1: PDFs + formulario
  ↓                                      ↓
Biblioteca (opcional, previo)      Paso 2: Chat IA
                                         ↓
                                   Confirmar veredicto
                                         ↓
                                   Subir .docx formato
                                         ↓
                                   Descargar borrador
```

**Máximo 3 clics** desde login hasta empezar a cargar PDFs:
1. Login
2. "+ Nueva tutela"
3. Seleccionar archivos

---

## 4. Principios UX para presentación a abogados

### 4.1 Lenguaje

| Evitar | Usar |
|--------|------|
| Caso, demanda | Tutela |
| Demandante / demandado | Accionante / accionado |
| Calificar demanda | Analizar tutela |
| IA sugiere | El asistente propone (usted decide) |
| Checklist art. 82 CGP | Requisitos Decreto 2591 |

### 4.2 Confianza y ética

- **Disclaimer fijo** en paso 2: *"Propuesta de apoyo. La decisión es suya."*
- **Fuentes visibles** en chat: qué norma de biblioteca se citó.
- **Campos ámbar** = "revise esto", no error.
- **Sin cajas rojas** salvo bloqueo real (PDF corrupto, API caída).

### 4.3 Reducir carga cognitiva

- Una acción primaria por pantalla (botón destacado).
- Formulario: máximo 6 campos visibles en paso 1; el resto en "Ver más" colapsable (v1.1).
- Chat: mensaje inicial estructurado (resumen, requisitos, propuesta, fuentes) — no muro de texto.

### 4.4 Manejo de errores (sin Ollama en prod)

| Escenario | UX |
|-----------|------|
| Gemini no responde | Toast: "Servicio de IA no disponible. Intente en unos minutos." + formulario manual sigue funcionando |
| Extracción falla | "No pudimos leer los PDFs automáticamente. Complete el formulario manualmente." |
| Sin biblioteca | Banner suave en paso 2: "Cargue normas en Biblioteca para mejores fundamentos." |

**No mostrar** "Ollama desconectado" en producción — confunde y ya no aplica.

---

## 5. Matriz de pantallas (v1 demo vs v1.1)

| Pantalla | v1 demo (ahora) | v1.1 producción |
|----------|-----------------|-----------------|
| Login | ✅ Simplificado | + logo despacho |
| Lista tutelas | ✅ | + filtros estado |
| Nueva tutela paso 1 | ✅ | + drag-drop visual |
| Detalle paso 2 | ⚠️ Placeholder + link avanzado | Chat completo |
| Biblioteca | ✅ Simplificada | - perfiles complejos |
| Plantilla Word | ❌ | Upload al final chat |
| Configuración | Redirige biblioteca | Eliminar o mínima |

---

## 6. Checklist pre-presentación a abogados

### Antes de la demo

- [ ] `GEMINI_API_KEY` en Vercel — probar `/api/llm/test`
- [ ] Usuario demo creado (`npm run seed:demo-user`)
- [ ] Biblioteca: normas del despacho (códigos locales). Decreto 2591 se consulta vía Gestor/MCP, no hace falta subirlo a mano.
- [ ] 1 tutela PDF anonimizada lista para demo en vivo
- [ ] `LEGAL_LLM_ALLOW_OLLAMA_FALLBACK=false` en Vercel

### Durante la demo (guión 5 min)

1. Login con usuario demo
2. Mostrar biblioteca (30 s): "Aquí están las normas"
3. Nueva tutela → subir PDF → campos prellenados
4. Corregir un campo ámbar (muestra control humano)
5. Guardar → paso 2 (explicar chat próximo)
6. Mencionar: plantilla Word al final, no en biblioteca

### Preguntas que anticipar

| Pregunta abogado | Respuesta |
|------------------|-----------|
| ¿La IA decide por mí? | No. Propone; usted confirma y firma. |
| ¿Mis datos salen del despacho? | PDFs en su Supabase; IA vía API Google (ver ToS). |
| ¿Funciona sin internet? | No en producción; requiere API cloud. |
| ¿Puedo usar mi formato Word? | Sí, lo sube al final de cada tutela. |

---

## 7. Prioridades UX post-demo (backlog)

1. **Chat paso 2** integrado en `/tutelas/[id]` (sin "vista avanzada")
2. **Upload plantilla** post-consenso
3. **Colapsar campos secundarios** en formulario paso 1
4. **Banner biblioteca vacía** si no hay documentos
5. **Quitar indicador IA** del footer o mover a solo admins
6. **Modo oscuro** — no prioritario

---

## 8. Conclusión

**Para presentar a abogados ahora:** el flujo simplificado es presentable con el guión de demo de §6. No hace falta tutorial interactivo; el stepper de 2 pasos + empty states son suficientes.

**Stepper:** mantener el actual de 2 pasos; añadir sub-pasos solo en generación Word (fase 4).

**Tutoriales:** posponer. Preferir **1 página de ayuda** estática (`/ayuda`) con 3 bullets si piden documentación escrita.

Ver implementación en `app/tutelas/` y roadmap en `ROADMAP_TUTELAS.md`.
