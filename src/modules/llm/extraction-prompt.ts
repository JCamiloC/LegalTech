interface TextWindow {
  start: number;
  end: number;
}

interface ExtractionSeed {
  radicado?: string;
  tipo_proceso?: string;
  demandante_nombre?: string;
  demandado_nombre?: string;
  cuantia?: string;
  competencia_territorial?: string;
  despacho?: string;
  fecha_demanda?: string;
}

function getMaxContextChars(): number {
  const raw = Number(process.env.LEGAL_LLM_MAX_CONTEXT_CHARS ?? 42000);
  if (!Number.isFinite(raw) || raw < 12000) {
    return 42000;
  }

  return Math.floor(raw);
}

function clampWindow(start: number, end: number, length: number): TextWindow {
  const normalizedStart = Math.max(0, Math.min(start, Math.max(length - 1, 0)));
  const normalizedEnd = Math.max(normalizedStart, Math.min(end, length));
  return { start: normalizedStart, end: normalizedEnd };
}

function mergeOverlappingWindows(windows: TextWindow[]): TextWindow[] {
  if (windows.length <= 1) {
    return windows;
  }

  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: TextWindow[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function selectRelevantContext(input: string, maxChars = getMaxContextChars()): string {
  const normalized = input.trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const windows: TextWindow[] = [];
  const headChars = Math.min(16000, Math.floor(maxChars * 0.45));
  const tailChars = Math.min(12000, Math.floor(maxChars * 0.3));
  windows.push(clampWindow(0, headChars, normalized.length));
  windows.push(clampWindow(normalized.length - tailChars, normalized.length, normalized.length));

  const keywordRegex =
    /radicado|referencia|demandante|demandado|dte\s*:|ddo\s*:|pretensiones|hechos|competencia|juzgado|despacho|proceso|cuant[ií]a|fecha\s+de\s+demanda/gi;
  const aroundChars = 600;
  let match = keywordRegex.exec(normalized);
  while (match) {
    windows.push(clampWindow(match.index - aroundChars, match.index + aroundChars, normalized.length));
    if (windows.length >= 120) {
      break;
    }
    match = keywordRegex.exec(normalized);
  }

  const merged = mergeOverlappingWindows(windows);
  const selected: string[] = [];
  let total = 0;

  for (const window of merged) {
    const chunk = normalized.slice(window.start, window.end).trim();
    if (!chunk) {
      continue;
    }

    if (total + chunk.length > maxChars) {
      const remaining = maxChars - total;
      if (remaining > 800) {
        selected.push(chunk.slice(0, remaining));
      }
      break;
    }

    selected.push(chunk);
    total += chunk.length;
  }

  const preserved = selected.join("\n\n--- CORTE DE CONTEXTO ---\n\n").trim();
  return `${preserved}\n\n[TRUNCADO ${normalized.length - preserved.length} caracteres por limite de contexto]`;
}

function buildSeedHints(seed?: ExtractionSeed): string[] {
  if (!seed) {
    return [];
  }

  const entries = Object.entries(seed)
    .map(([key, value]) => [key, String(value ?? "").trim()] as const)
    .filter(([, value]) => value.length > 0);

  if (entries.length === 0) {
    return [];
  }

  return [
    "Pistas preextraidas (si contradicen evidencia documental clara, prevalece el documento):",
    ...entries.map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];
}

export function buildExtractionPrompt(documentText: string, seed?: ExtractionSeed): string {
  const safeText = selectRelevantContext(documentText);
  const seedHints = buildSeedHints(seed);

  return [
    "Eres un asistente juridico colombiano especializado en calificacion de demandas.",
    "Analiza el texto OCR del expediente y responde UNICAMENTE un JSON valido.",
    "No incluyas markdown, explicaciones ni texto adicional.",
    "",
    "Debes devolver exactamente esta estructura:",
    "{",
    '  "campos_caso": {',
    '    "radicado": { "valor": string, "confianza": "alto|medio|bajo" },',
    '    "tipo_proceso": { "valor": string, "confianza": "alto|medio|bajo" },',
    '    "subtipo_proceso": { "valor": string|null, "confianza": "alto|medio|bajo" },',
    '    "demandante_nombre": { "valor": string, "confianza": "alto|medio|bajo" },',
    '    "demandado_nombre": { "valor": string, "confianza": "alto|medio|bajo" },',
    '    "cuantia": { "valor": number|null, "confianza": "alto|medio|bajo" },',
    '    "competencia_territorial": { "valor": string|null, "confianza": "alto|medio|bajo" },',
    '    "despacho": { "valor": string|null, "confianza": "alto|medio|bajo" },',
    '    "pretensiones_resumen": { "valor": string|null, "confianza": "alto|medio|bajo" },',
    '    "hechos_resumen": { "valor": string|null, "confianza": "alto|medio|bajo" },',
    '    "fecha_demanda": { "valor": "YYYY-MM-DD"|null, "confianza": "alto|medio|bajo" }',
    "  },",
    '  "checklist": {',
    '    "cumple_art_82": { "valor": boolean, "razon": string },',
    '    "anexos_completos": { "valor": boolean, "razon": string },',
    '    "poder_aportado": { "valor": boolean, "razon": string },',
    '    "legitimacion_causa": { "valor": boolean, "razon": string },',
    '    "competencia_valida": { "valor": boolean, "razon": string },',
    '    "titulo_ejecutivo_valido": { "valor": boolean, "razon": string },',
    '    "indebida_acumulacion": { "valor": boolean, "razon": string },',
    '    "caducidad": { "valor": boolean, "razon": string },',
    '    "prescripcion": { "valor": boolean, "razon": string }',
    "  },",
    '  "inventario_documentos": {',
    '    "encontrados": string[],',
    '    "faltantes": string[],',
    '    "requeridos_por_tipo_proceso": string[]',
    "  }",
    "}",
    "",
    "Si un dato no es inferible, usa null o cadena vacia segun corresponda, sin inventar.",
    ...seedHints,
    "",
    "=== TEXTO OCR DEL EXPEDIENTE ===",
    safeText,
  ].join("\n");
}
