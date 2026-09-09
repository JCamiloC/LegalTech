# Plan de trabajo compartido — Asistente legal (calificacion de demandas)

> **Documento histórico.** Reemplazado por el plan de tutelas v1.
> Ver: [ROADMAP_TUTELAS.md](./ROADMAP_TUTELAS.md).

---

# Plan de trabajo compartido — Asistente legal (calificacion de demandas)

Este plan esta hecho para ejecutar en conjunto.
- Tus tareas: ejecucion operativa, validaciones de negocio, pruebas con expedientes reales.
- Mis tareas: implementacion tecnica, ajustes de prompts, integracion, QA tecnico y soporte.

Objetivo: simplificar al maximo el trabajo de calificacion de demandas hasta dejar un flujo casi automatico y seguro para despacho.

---

## 1) Como usar este plan

Regla simple de trabajo:
1. Tu marcas una tarea como completada.
2. Me escribes: "Complete Tarea Ux.y".
3. Yo ejecuto de inmediato la(s) tarea(s) tecnica(s) asociada(s).
4. Hacemos validacion rapida y pasamos al siguiente bloque.

Formato de estado:
- [ ] Pendiente
- [~] En progreso
- [x] Completada

---

## 2) Tablero maestro (tareas tuyas y mias)

### Fase A — Preparacion y control de calidad de insumos

- [ ] U.A1 Reunir 10 expedientes reales de prueba (anonimizados)
  Que significa:
  - Seleccionar casos representativos: ejecutivo, verbal, monitorio, ordinario.
  - Incluir casos faciles y dificiles.
  - Quitar datos sensibles o reemplazarlos.
  Evidencia de cierre:
  - Carpeta organizada con 10 expedientes.

- [x] C.A1 Crear matriz de evaluacion de precision
  Que hare yo:
  - Armar formato para medir: extraccion, checklist, decision, documento.
  - Definir score minimo por campo critico.
  Entregable:
  - Plantilla de evaluacion en docs (docs/MATRIZ_EVALUACION_PRECISION_CASOS.md).

- [ ] U.A2 Definir campos criticos obligatorios para tu despacho
  Que significa:
  - Lista cerrada de datos que no pueden faltar (ej: radicado, partes, tipo proceso, cuantia, poder, competencia).
  Evidencia de cierre:
  - Lista firmada por ti (aunque sea en texto corto).

- [x] C.A2 Ajustar validaciones con esos campos criticos
  Que hare yo:
  - Marcar esos campos como bloqueo o alerta en UI.
  - Aplicar reglas de confianza minima.
  Avance actual:
  - Ya existe validacion por perfil en runtime (configuracion del despacho), con modo alerta/bloqueo y campos criticos configurables.

### Fase B — Extraccion juridica robusta

- [ ] C.B1 Extraer con evidencia por campo
  Que hare yo:
  - Cada dato extraido tendra: valor, confianza, documento_origen y fragmento_evidencia.
  Resultado esperado:
  - Facil auditoria y correccion rapida.

- [ ] C.B2 Reintento automatico de campos faltantes
  Que hare yo:
  - Si falta un campo critico, hacer segundo llamado al LLM enfocado solo en ese campo.
  Resultado esperado:
  - Mayor cobertura sin mas trabajo manual.

- [ ] U.B1 Validar 10 expedientes con la matriz
  Que significa:
  - Probar uno por uno y registrar errores por campo.
  Evidencia de cierre:
  - Matriz diligenciada (aunque sea parcial).

- [ ] C.B3 Mejorar prompt y normalizacion segun hallazgos
  Que hare yo:
  - Afinar prompt de extraccion.
  - Normalizar formatos: fechas, cuantia, nombres, tipo_proceso.

### Fase C — Checklist casi automatico

- [ ] C.C1 Checklist con razon y evidencia
  Que hare yo:
  - Mostrar por item: cumple/no cumple, razon legal, evidencia textual.

- [ ] U.C1 Confirmar criterios de cada item del checklist
  Que significa:
  - Revisar si la logica aplicada coincide con tu practica real.
  Evidencia de cierre:
  - Lista corta de ajustes por item.

- [ ] C.C2 Ajustar checklist a criterio real del despacho
  Que hare yo:
  - Incorporar tus ajustes y priorizar alertas realmente relevantes.

### Fase D — Sugerencia de decision y parte motiva

- [~] C.D1 Fortalecer decision IA con casos similares utiles
  Que hare yo:
  - Mejorar ranking de historicos.
  - Usar solo similares de valor real (tipo_proceso, defectos, resultado).
  Avance actual:
  - Se incorporo contexto de biblioteca por perfil con ranking por relevancia y se persiste trazabilidad de documentos usados por sugerencia IA.

- [x] C.D4 Trazabilidad de fuentes de biblioteca en sugerencia IA
  Que hare yo:
  - Guardar en cada sugerencia IA los documentos de biblioteca usados como contexto.
  - Mostrar esa traza en el detalle del caso para auditoria juridica.
  Entregable:
  - Columna `biblioteca_contexto_json` en `case_ai_suggestions` + visualizacion en `casos/[id]`.

- [ ] C.D2 Generar parte motiva estructurada por plantilla juridica
  Que hare yo:
  - Estructura fija: antecedentes, consideraciones, subsuncion, decision.

- [ ] U.D1 Revisar 10 sugerencias y marcar acierto/error
  Que significa:
  - Para cada caso, indicar si la recomendacion IA fue correcta.
  Evidencia de cierre:
  - Marcacion de fue_correcta + nota breve cuando no acierta.

- [ ] C.D3 Retroalimentar modelo por tus correcciones
  Que hare yo:
  - Ajustar prompts y pesos de contexto usando tus decisiones reales.

### Fase E — Documento final y acta de correcciones

- [ ] U.E1 Aprobar formato final de plantilla (auto + acta)
  Que significa:
  - Confirmar estilo, encabezado, variables y redaccion minima esperada.

- [ ] C.E1 Completar mapeo de variables en DOCX
  Que hare yo:
  - Garantizar variables completas: pretensiones, hechos, parte_motiva, defectos, fundamento.

- [ ] C.E2 Mejorar acta de correcciones para uso real
  Que hare yo:
  - Ordenar defectos por prioridad.
  - Redaccion lista para radicar o notificar.

- [ ] U.E2 Validar 5 documentos reales sin edicion mayor
  Que significa:
  - Medir si salen listos con correcciones minimas.

### Fase F — Operacion estable en despacho

- [ ] C.F1 Dashboard de calidad operacional
  Que hare yo:
  - Mostrar: precision de sugerencia, porcentaje de aceptacion, tiempos promedio.

- [ ] U.F1 Definir umbral de salida a produccion
  Que significa:
  - Ejemplo: 80% precision decision y 90% campos criticos correctos.

- [ ] C.F2 Cerrar version candidata a produccion
  Que hare yo:
  - Congelar cambios, checklist final tecnico, guia de operacion diaria.

---

## 3) Paso a paso operativo por bloque

## Bloque 1 (Semana 1)

Tu paso a paso:
1. Completar U.A1 (10 expedientes anonimizados).
2. Completar U.A2 (lista de campos criticos).
3. Compartirme confirmacion en chat.

Mi paso a paso:
1. Ejecutar C.A1 (matriz evaluacion).
2. Ejecutar C.A2 (validaciones segun campos criticos).
3. Entregarte lista de pruebas exactas para U.B1.

## Bloque 2 (Semana 2)

Tu paso a paso:
1. Ejecutar U.B1 con la matriz.
2. Marcar errores por campo y caso.

Mi paso a paso:
1. Ejecutar C.B1 y C.B2.
2. Ajustar con C.B3 usando tus resultados.

## Bloque 3 (Semana 3)

Tu paso a paso:
1. Ejecutar U.C1 (criterio checklist).
2. Ejecutar U.D1 (acierto/error decision IA).

Mi paso a paso:
1. Ejecutar C.C1 y C.C2.
2. Ejecutar C.D1, C.D2 y C.D3.

## Bloque 4 (Semana 4)

Tu paso a paso:
1. Ejecutar U.E1 y U.E2.
2. Definir U.F1 (umbral de salida).

Mi paso a paso:
1. Ejecutar C.E1 y C.E2.
2. Ejecutar C.F1 y C.F2.

---

## 4) Definicion de "casi automatizado" para este proyecto

Se considera logrado cuando:
- La abogada solo hace 4 acciones:
  1) Cargar expediente
  2) Revisar alertas de baja confianza
  3) Confirmar o ajustar decision
  4) Descargar auto y acta
- Tiempo total por caso estandar <= 3 minutos.
- Precision de decision >= 80% despues de 30-50 casos.
- Campos criticos correctos >= 90%.

---

## 5) Registro rapido de avances (bitacora)

Fecha:
Tarea completada (U o C):
Que salio bien:
Que fallo:
Decision tomada:
Siguiente paso:

---

## 6) Protocolo de trabajo contigo (Copilot)

Cuando completes una tarea tuya, enviame este formato:
- "Complete U.XY"
- "Evidencia: ..."
- "Bloqueo actual (si existe): ..."

Con eso yo respondo con:
1. Cambios tecnicos que hago de inmediato.
2. Como validarlos en 5 minutos.
3. Siguiente tarea tuya sugerida.
