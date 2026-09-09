# Rediseño del core — Oficial mayor (Rama Judicial Colombia)

> **Documento histórico.** El alcance se redefinió en enero 2026 hacia un flujo único de tutelas.
> Ver: [VISION_TUTELAS.md](./VISION_TUTELAS.md) y [ROADMAP_TUTELAS.md](./ROADMAP_TUTELAS.md).

---

# Rediseno del core - Oficial mayor (Rama Judicial Colombia)

## Objetivo

Pasar de una app generalista a una experiencia guiada para una oficial mayor:
- Menos configuracion tecnica.
- Mas flujo operativo por perfil.
- Biblioteca viva que ella misma alimenta.

## Problema actual

- Reglas, articulos y plantillas existen, pero estan separados.
- El criterio del despacho no esta modelado como "perfil de trabajo".
- La curva de aprendizaje es alta para mantener la IA alineada.
- Dependencia de un set fijo inicial de casos de exito.

## Modelo propuesto

### 1) Modulo Configuracion

Ruta: /configuracion

Define por perfil:
- Checklist base (items y etiqueta legible).
- Campos criticos requeridos.
- Confianza minima por defecto.
- Modo alerta/bloqueo ante faltantes.

### 2) Modulo Biblioteca

Ruta: /biblioteca

Permite cargar conocimiento por perfil con estructura:
- Perfil
- Carpeta
- Documento de biblioteca

Cada documento puede incluir:
- tipo_documento (caso_exito, criterio_despacho, nota_operativa, etc)
- etiquetas
- contenido_texto util para criterio IA
- vinculo opcional a case_id

## Beneficios operativos

- No depende de "10 casos de exito" como requisito de arranque.
- La abogada puede crecer la biblioteca en uso diario.
- El criterio del despacho queda explicito y versionable.
- Disminuye friccion de adopcion para otros despachos.

## UX recomendada (siguiente iteracion)

1. Asistente inicial de 3 pasos
- Crear perfil
- Definir campos criticos
- Cargar 3 documentos de ejemplo

2. Carga asistida de PDF a biblioteca
- Subida multiple
- OCR
- Resumen automatico editable
- Sugerencia de carpeta y etiquetas

3. Constructor visual de checklist
- Sin JSON
- Arrastrar/soltar prioridades
- Toggle de bloqueo por item

4. Recomendacion de uso de biblioteca en cada caso
- Mostrar "que documentos del perfil se usaron"
- Mostrar "por que fueron relevantes"

5. Modo foco operacional
- Solo 4 acciones visibles en pantalla principal:
  - Cargar expediente
  - Revisar alertas
  - Confirmar decision
  - Descargar documento

## Implementado en esta fase

- Nuevas tablas: perfiles, settings, carpetas, documentos de biblioteca.
- UI inicial de /configuracion y /biblioteca.
- Accesos directos desde /casos.

## Pendiente para cerrar ciclo

- Integrar settings de perfil al motor de extraccion/validacion en runtime.
- Integrar biblioteca como contexto en decision LLM.
- Importacion directa de PDF a biblioteca (archivo + OCR + metadatos).
- Filtros por tipo_proceso y etapa procesal en biblioteca.
