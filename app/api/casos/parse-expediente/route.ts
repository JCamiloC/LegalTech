import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KnowledgeRepository } from "@/modules/knowledge";
import { LlmExtractionService } from "@/modules/llm";

export const runtime = "nodejs";

const MAX_FILES_PER_REQUEST = 25;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const DEFAULT_PDF_PARSE_CONCURRENCY = 3;
const DEFAULT_MAX_DOCS_FOR_LLM = 12;
const MAX_REDIRECT_QUERY_LENGTH = 7000;
const MAX_QUERY_VALUE_LENGTH = 1800;

const PRIORITY_PATTERNS: Array<{ priority: number; pattern: RegExp }> = [
  { priority: 1, pattern: /demanda|principal|escrito\s+inicial/i },
  { priority: 2, pattern: /poder|mandato/i },
  { priority: 3, pattern: /pagare|letra|titulo\s+ejecutivo|titulo/i },
  { priority: 4, pattern: /anexo|anexos|soporte|certificado|camara/i },
];

function normalizeDocumentText(content: string): string {
  return content.replace(/\r/g, "\n").replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/ +/g, " ");
}

function findFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value.length > 0) {
        return value;
      }
    }
  }

  return null;
}

function parseCuantia(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const numeric = rawValue.replace(/[^\d,\.]/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
  if (!numeric) {
    return null;
  }

  const parsed = Number(numeric);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return String(parsed);
}

function inferTipoProceso(text: string, extracted: string | null): string | null {
  if (extracted) {
    return extracted.trim().toLowerCase();
  }

  const lower = text.toLowerCase();
  if (lower.includes("proceso ejecutivo")) return "ejecutivo";
  if (lower.includes("demanda ejecutiva para la efectividad de la garant")) return "ejecutivo con garantía real";
  if (lower.includes("proceso verbal")) return "verbal";
  if (lower.includes("proceso monitorio")) return "monitorio";
  if (lower.includes("proceso ordinario")) return "ordinario";

  return null;
}

async function extractTextFromPdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (pdfModule.default ?? pdfModule) as (data: Buffer) => Promise<{ text?: string }>;
  const result = await pdfParse(Buffer.from(arrayBuffer));
  return normalizeDocumentText(result.text ?? "");
}

interface ExtractionBatchResult {
  text: string;
  parsedFiles: string[];
  skippedFiles: Array<{ name: string; reason: string }>;
}

interface ParsedChunk {
  index: number;
  fileName: string;
  text: string;
}

function getPdfParseConcurrency(): number {
  const raw = Number(process.env.LEGAL_PDF_PARSE_CONCURRENCY ?? DEFAULT_PDF_PARSE_CONCURRENCY);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_PDF_PARSE_CONCURRENCY;
  }

  return Math.min(Math.floor(raw), 8);
}

function getMaxDocsForLlm(): number {
  const raw = Number(process.env.LEGAL_MAX_DOCS_FOR_LLM ?? DEFAULT_MAX_DOCS_FOR_LLM);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_MAX_DOCS_FOR_LLM;
  }

  return Math.min(Math.floor(raw), MAX_FILES_PER_REQUEST);
}

function compactErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Error desconocido";
  return raw.replace(/\s+/g, " ").trim().slice(0, 140);
}

function getFilePriority(name: string): number {
  for (const item of PRIORITY_PATTERNS) {
    if (item.pattern.test(name)) {
      return item.priority;
    }
  }

  return 99;
}

function sortFilesForAnalysis(files: File[]): File[] {
  return [...files].sort((a, b) => {
    const priorityDiff = getFilePriority(a.name) - getFilePriority(b.name);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.name.localeCompare(b.name, "es");
  });
}

async function extractTextFromPdfFiles(files: File[]): Promise<ExtractionBatchResult> {
  const chunks: ParsedChunk[] = [];
  const parsedFiles: string[] = [];
  const skippedFiles: Array<{ name: string; reason: string }> = [];
  const concurrency = getPdfParseConcurrency();
  let currentIndex = 0;

  const worker = async () => {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;

      if (index >= files.length) {
        return;
      }

      const file = files[index];

      if (file.size > MAX_FILE_SIZE_BYTES) {
        skippedFiles.push({
          name: file.name,
          reason: `Supera límite por archivo (${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB)`,
        });
        continue;
      }

      try {
        const text = await extractTextFromPdfFile(file);
        if (!text.trim()) {
          skippedFiles.push({ name: file.name, reason: "Sin texto legible" });
          continue;
        }

        chunks.push({ index, fileName: file.name, text });
        parsedFiles.push(file.name);
      } catch (error) {
        skippedFiles.push({ name: file.name, reason: compactErrorMessage(error) });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));

  const sortedChunks = chunks.sort((a, b) => a.index - b.index);

  return {
    text: normalizeDocumentText(
      sortedChunks
        .map((item) => `\n\n--- DOCUMENTO ${item.index + 1}: ${item.fileName} ---\n${item.text}`)
        .join("\n")
    ),
    parsedFiles,
    skippedFiles,
  };
}

function limitTextForLlm(text: string): { text: string; droppedDocs: number } {
  const parts = text.split(/\n\n--- DOCUMENTO \d+: .*? ---\n/g);
  if (parts.length <= 2) {
    return { text, droppedDocs: 0 };
  }

  const markers = text.match(/\n\n--- DOCUMENTO \d+: .*? ---\n/g) ?? [];
  const maxDocs = getMaxDocsForLlm();
  const totalDocs = markers.length;
  if (totalDocs <= maxDocs) {
    return { text, droppedDocs: 0 };
  }

  let limited = "";
  for (let index = 0; index < maxDocs; index += 1) {
    const marker = markers[index] ?? "";
    const body = parts[index + 1] ?? "";
    limited += `${marker}${body}`;
  }

  return {
    text: normalizeDocumentText(limited),
    droppedDocs: totalDocs - maxDocs,
  };
}

function ensurePdfFile(value: FormDataEntryValue | null, errorMessage: string): File {
  if (!(value instanceof File)) {
    throw new Error(errorMessage);
  }

  const isPdf = value.type === "application/pdf" || value.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    throw new Error("Formato no soportado. Use archivos .pdf");
  }

  return value;
}

function resolveRedirectBase(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "").trim();
  if (value === "/tutelas/nueva" || value.startsWith("/tutelas")) {
    return value.endsWith("/nueva") ? value : "/tutelas/nueva";
  }
  return "/casos/nuevo";
}

function redirectWith(request: NextRequest, params: URLSearchParams, base = "/casos/nuevo"): NextResponse {
  const url = new URL(`${base}?${params.toString()}`, request.url);
  return NextResponse.redirect(url, { status: 303 });
}

function clipValue(value: string, maxLength = MAX_QUERY_VALUE_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

function trySetQueryValue(
  query: URLSearchParams,
  key: string,
  value: string,
  options?: { maxLength?: number; force?: boolean }
): boolean {
  const maxLength = options?.maxLength ?? MAX_QUERY_VALUE_LENGTH;
  const force = options?.force ?? false;
  const normalized = clipValue(value.trim(), maxLength);

  if (!normalized) {
    return false;
  }

  const previous = query.get(key);
  query.set(key, normalized);

  if (force) {
    return true;
  }

  if (query.toString().length > MAX_REDIRECT_QUERY_LENGTH) {
    if (previous !== null) {
      query.set(key, previous);
    } else {
      query.delete(key);
    }
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  let redirectBase = "/casos/nuevo";

  try {
    const formData = await request.formData();
    redirectBase = resolveRedirectBase(formData.get("redirect_base"));
    const profileIdRaw = String(formData.get("profile_id") ?? "").trim();

    const expedienteEntries = formData.getAll("expediente_files");
    const expedienteFiles = expedienteEntries
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((entry) => ensurePdfFile(entry, "Uno de los archivos del expediente no es válido"));

    const demandaPrincipalRaw = formData.get("demanda_principal");
    const demandaPrincipal =
      demandaPrincipalRaw instanceof File && demandaPrincipalRaw.size > 0
        ? ensurePdfFile(demandaPrincipalRaw, "Debe adjuntar la demanda principal en PDF")
        : null;

    const anexosEntries = formData.getAll("anexos_files");
    const anexosFiles = anexosEntries
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((entry) => ensurePdfFile(entry, "Uno de los anexos no es válido"));

    const allFiles =
      expedienteFiles.length > 0
        ? expedienteFiles
        : [demandaPrincipal, ...anexosFiles].filter((file): file is File => Boolean(file));

    if (allFiles.length === 0) {
      throw new Error("Debe adjuntar al menos un PDF del expediente");
    }

    if (allFiles.length > MAX_FILES_PER_REQUEST) {
      throw new Error(`Máximo ${MAX_FILES_PER_REQUEST} archivos por análisis. Reduce la cantidad de anexos.`);
    }

    const orderedFiles = sortFilesForAnalysis(allFiles);

    const extractionBatch = await extractTextFromPdfFiles(orderedFiles);
    const text = extractionBatch.text;
    const query = new URLSearchParams();
    trySetQueryValue(query, "ok", "expediente_importado", { force: true });
    if (profileIdRaw.length > 0) {
      trySetQueryValue(query, "profile_id", profileIdRaw, { force: true, maxLength: 120 });
    }

    if (extractionBatch.skippedFiles.length > 0) {
      const skippedSummary = extractionBatch.skippedFiles
        .slice(0, 5)
        .map((item) => `${item.name} (${item.reason})`)
        .join("; ");
      const extraCount = extractionBatch.skippedFiles.length > 5 ? ` y ${extractionBatch.skippedFiles.length - 5} más` : "";
      trySetQueryValue(
        query,
        "warn",
        `Se omitieron ${extractionBatch.skippedFiles.length} archivo(s): ${skippedSummary}${extraCount}.`
      );
    }

    if (extractionBatch.parsedFiles.length > 0) {
      trySetQueryValue(query, "docs_ok", String(extractionBatch.parsedFiles.length), { force: true, maxLength: 16 });
    }

    if (extractionBatch.parsedFiles.length === 0) {
      throw new Error("Ningún PDF del expediente pudo ser leído. Verifica archivos dañados o escaneados sin OCR.");
    }

    if (!text.trim() || text.trim().length < 80) {
      throw new Error("No se pudo extraer texto suficiente del expediente para prellenar el caso.");
    }

    const limitedForLlm = limitTextForLlm(text);
    if (limitedForLlm.droppedDocs > 0) {
      trySetQueryValue(
        query,
        "warn_llm_scope",
        `Para optimizar tiempo, IA analizó primero ${getMaxDocsForLlm()} documento(s) priorizados y omitió ${limitedForLlm.droppedDocs} del contexto LLM.`
      );
    }

    const llmExtraction = await new LlmExtractionService().extractFromText(limitedForLlm.text);
    if (llmExtraction) {
      let criticalConfig:
        | {
            required_fields?: string[];
            minimum_confidence?: string;
            block_on_missing?: boolean;
          }
        | undefined;

      if (profileIdRaw.length > 0) {
        const supabase = await createSupabaseServerClient();
        const settings = await new KnowledgeRepository(supabase).getProfileSettings(profileIdRaw);
        if (settings) {
          criticalConfig = {
            required_fields: settings.critical_fields,
            minimum_confidence: settings.minimum_confidence,
            block_on_missing: settings.block_on_missing,
          };
        }
      }

      const llmFields = new LlmExtractionService().extractionToFormFields(llmExtraction, criticalConfig);
      const droppedFields: string[] = [];
      for (const [key, value] of Object.entries(llmFields)) {
        if (!value || value.trim().length === 0) {
          continue;
        }

        // Avoid very large payloads in URL redirects.
        if (key === "llm_extraccion_json") {
          continue;
        }

        const maxLength =
          key === "pretensiones_resumen" || key === "hechos_resumen"
            ? 2200
            : key.endsWith("_json")
              ? 1400
              : MAX_QUERY_VALUE_LENGTH;

        const stored = trySetQueryValue(query, key, value, { maxLength });
        if (!stored) {
          droppedFields.push(key);
        }
      }

      if (droppedFields.length > 0) {
        const droppedMessage = `Algunos campos fueron omitidos por tamaño de URL: ${droppedFields.slice(0, 5).join(", ")}${
          droppedFields.length > 5 ? ` y ${droppedFields.length - 5} más` : ""
        }.`;
        trySetQueryValue(query, "warn", droppedMessage);
      }

      return redirectWith(request, query, redirectBase);
    }

    const radicado = findFirstMatch(text, [
      /radicado\s*(?:no\.?|n\.?|número|num\.?|#)?\s*[:\-]?\s*([A-Z0-9\-\.\/]{6,})/i,
      /referencia\s*[:\-]\s*([A-Z0-9\-\.\/]{6,})/i,
    ]);
    const demandante = findFirstMatch(text, [
      /dte\s*[:\-]\s*([^\n]{3,140})/i,
      /demandante(?:s)?\s*[:\-]\s*([^\n]{3,120})/i,
      /actor(?:a)?\s*[:\-]\s*([^\n]{3,120})/i,
    ]);
    const demandado = findFirstMatch(text, [
      /ddo\s*[:\-]\s*([^\n]{3,140})/i,
      /demandado(?:s)?\s*[:\-]\s*([^\n]{3,120})/i,
      /convocado(?:s)?\s*[:\-]\s*([^\n]{3,120})/i,
    ]);
    const tipoProcesoRaw = findFirstMatch(text, [
      /ref\s*[:\-]\s*([^\n]{3,180})/i,
      /tipo\s+de\s+proceso\s*[:\-]\s*([^\n]{3,100})/i,
      /proceso\s*[:\-]\s*([^\n]{3,100})/i,
    ]);
    const subtipoProceso = findFirstMatch(text, [/subtipo\s+de\s+proceso\s*[:\-]\s*([^\n]{3,100})/i]);
    const cuantiaRaw = findFirstMatch(text, [
      /cuant[ií]a\s*[:\-]?\s*\$?\s*([^\n]{1,40})/i,
      /pretensiones\s*[:\-]?\s*\$?\s*([^\n]{1,40})/i,
    ]);
    const competencia = findFirstMatch(text, [
      /competencia\s+territorial\s*[:\-]\s*([^\n]{3,120})/i,
      /competencia\s*[:\-]\s*([^\n]{3,120})/i,
    ]);
    const despacho = findFirstMatch(text, [
      /juzgado\s*[:\-]\s*([^\n]{3,160})/i,
      /despacho\s*[:\-]\s*([^\n]{3,160})/i,
    ]);

    if (radicado) trySetQueryValue(query, "radicado", radicado, { maxLength: 120 });
    if (demandante) trySetQueryValue(query, "demandante_nombre", demandante, { maxLength: 180 });
    if (demandado) trySetQueryValue(query, "demandado_nombre", demandado, { maxLength: 180 });

    const tipoProceso = inferTipoProceso(text, tipoProcesoRaw);
    if (tipoProceso) trySetQueryValue(query, "tipo_proceso", tipoProceso, { maxLength: 120 });
    if (subtipoProceso) trySetQueryValue(query, "subtipo_proceso", subtipoProceso, { maxLength: 180 });

    const cuantia = parseCuantia(cuantiaRaw);
    if (cuantia) trySetQueryValue(query, "cuantia", cuantia, { maxLength: 60 });
    if (competencia) trySetQueryValue(query, "competencia_territorial", competencia, { maxLength: 180 });
    if (despacho) trySetQueryValue(query, "despacho", despacho, { maxLength: 180 });

    return redirectWith(request, query, redirectBase);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible importar el documento";
    const query = new URLSearchParams();
    trySetQueryValue(query, "error", message, { force: true, maxLength: 280 });
    return redirectWith(request, query, redirectBase);
  }
}
