import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeDecisionType } from "@/modules/documents";
import { KnowledgeRepository } from "@/modules/knowledge";
import { LlmExtractionService } from "@/modules/llm";

export const runtime = "nodejs";

type SupportedFileKind = "pdf" | "docx";

function ensureSupportedFile(value: FormDataEntryValue | null): { file: File; kind: SupportedFileKind } {
  if (!(value instanceof File)) {
    throw new Error("Debes adjuntar un archivo PDF o DOCX");
  }

  const fileName = value.name.toLowerCase();
  const isPdf = value.type === "application/pdf" || fileName.endsWith(".pdf");
  const isDocx =
    value.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx");

  if (!isPdf && !isDocx) {
    throw new Error("Solo se permiten archivos PDF o DOCX");
  }

  return {
    file: value,
    kind: isPdf ? "pdf" : "docx",
  };
}

function normalizeDocumentText(content: string): string {
  return content.replace(/\r/g, "\n").replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/ +/g, " ");
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseReplaceableFields(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/\s+/g, "_"));
}

function safeSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_\.]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function extractTextFromPdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (pdfModule.default ?? pdfModule) as (data: Buffer) => Promise<{ text?: string }>;
  const result = await pdfParse(Buffer.from(arrayBuffer));
  return normalizeDocumentText(result.text ?? "");
}

async function extractTextFromDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const extracted = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
  return normalizeDocumentText(extracted.value ?? "");
}

async function extractTextFromFile(file: File, kind: SupportedFileKind): Promise<string> {
  if (kind === "pdf") {
    return extractTextFromPdfFile(file);
  }

  return extractTextFromDocxFile(file);
}

async function uploadSourceFile(params: {
  profileId: string;
  file: File;
}): Promise<{ path: string | null; warning: string | null }> {
  const adminClient = createSupabaseAdminClient();
  const fileName = params.file.name || "archivo";
  const objectPath = `knowledge-library/${params.profileId}/${Date.now()}-${safeSegment(fileName)}`;
  const fileBuffer = Buffer.from(await params.file.arrayBuffer());
  const { error } = await adminClient.storage.from("decision-documents").upload(objectPath, fileBuffer, {
    upsert: true,
    contentType: params.file.type || "application/octet-stream",
  });

  if (error) {
    return {
      path: null,
      warning: "No se pudo guardar archivo fuente en Storage; se guardó contenido textual y metadatos.",
    };
  }

  return {
    path: objectPath,
    warning: null,
  };
}

function redirectWith(request: NextRequest, params: URLSearchParams): NextResponse {
  const profileId = params.get("profileId") ?? "";
  const query = new URLSearchParams(params);
  if (profileId) {
    query.set("profileId", profileId);
  }
  const url = new URL(`/biblioteca?${query.toString()}`, request.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  let profileId = "";

  try {
    const formData = await request.formData();
    profileId = String(formData.get("profile_id") ?? "").trim();

    if (!profileId) {
      throw new Error("Perfil requerido");
    }

    const fileInput = formData.get("archivo_pdf") ?? formData.get("archivo_fuente");
    const { file, kind } = ensureSupportedFile(fileInput);
    const folderId = String(formData.get("folder_id") ?? "").trim() || null;
    const caseId = String(formData.get("case_id") ?? "").trim() || null;
    const rawDocumentType = String(formData.get("tipo_documento") ?? "caso_exito_pdf").trim();
    const isLegalTemplate = rawDocumentType === "plantilla_legal";
    const manualTags = parseTags(String(formData.get("etiquetas") ?? ""));
    const replaceableFields = parseReplaceableFields(String(formData.get("campos_reemplazables") ?? ""));
    const decisionInput = String(formData.get("tipo_decision_libre") ?? "general").trim();
    const normalizedDecision = normalizeDecisionType(decisionInput);
    const manualTemplateText = String(formData.get("contenido_plantilla_texto") ?? "").trim();

    const text = await extractTextFromFile(file, kind);
    if (!text.trim()) {
      throw new Error("No se pudo extraer texto legible del archivo");
    }

    const llmService = new LlmExtractionService();
    const extraction = isLegalTemplate ? null : await llmService.extractFromText(text);

    const inferredTags = new Set<string>(manualTags);
    if (!isLegalTemplate && extraction?.campos_caso.tipo_proceso.valor) {
      inferredTags.add(extraction.campos_caso.tipo_proceso.valor);
    }
    if (isLegalTemplate) {
      inferredTags.add("plantilla_legal");
      inferredTags.add(normalizedDecision.normalized);
    }

    const summaryLines: string[] = [];
    summaryLines.push(`Fuente: ${file.name}`);
    if (!isLegalTemplate && extraction) {
      summaryLines.push(`Radicado: ${extraction.campos_caso.radicado.valor || "N/D"}`);
      summaryLines.push(`Tipo proceso: ${extraction.campos_caso.tipo_proceso.valor || "N/D"}`);
      summaryLines.push(`Demandante: ${extraction.campos_caso.demandante_nombre.valor || "N/D"}`);
      summaryLines.push(`Demandado: ${extraction.campos_caso.demandado_nombre.valor || "N/D"}`);
      summaryLines.push("Checklist relevante:");
      summaryLines.push(
        ...Object.entries(extraction.checklist).map(
          ([key, item]) => `- ${key}: ${item.valor ? "cumple" : "no cumple"}${item.razon ? ` (${item.razon})` : ""}`
        )
      );
    }

    summaryLines.push("");
    if (isLegalTemplate) {
      summaryLines.push(`Tipo de decisión normalizada: ${normalizedDecision.normalized}`);
      summaryLines.push(`Alias recibido: ${normalizedDecision.alias || "N/D"}`);
      if (replaceableFields.length > 0) {
        summaryLines.push(`Campos reemplazables: ${replaceableFields.join(", ")}`);
      }
      summaryLines.push("Texto plantilla (recortado):");
      summaryLines.push((manualTemplateText || text).slice(0, 4000));
    } else {
      summaryLines.push("Texto base (recortado):");
      summaryLines.push(text.slice(0, 4000));
    }

    const uploadResult = await uploadSourceFile({
      profileId,
      file,
    });

    const supabase = await createSupabaseServerClient();
    const repository = new KnowledgeRepository(supabase);

    const created = await repository.createDocument({
      profile_id: profileId,
      folder_id: folderId,
      case_id: caseId,
      titulo: String(formData.get("titulo") ?? "").trim() || file.name,
      tipo_documento: rawDocumentType || "caso_exito_pdf",
      etiquetas: Array.from(inferredTags),
      contenido_texto: isLegalTemplate ? manualTemplateText || text : summaryLines.join("\n"),
      resumen_texto: summaryLines.join("\n"),
      source_file_name: file.name,
      source_file_path: uploadResult.path,
      source_file_mime: file.type || (kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      source_file_size: file.size,
      decision_type_normalized: isLegalTemplate ? normalizedDecision.normalized : null,
      decision_type_alias: isLegalTemplate ? normalizedDecision.alias : null,
      replaceable_fields: isLegalTemplate ? replaceableFields : [],
      processing_status: "processed",
      metadata_json: {
        origen: "archivo_upload",
        extension: kind,
        nombre_archivo: file.name,
        tamano_bytes: file.size,
        source_path: uploadResult.path,
        tipo_decision: isLegalTemplate ? normalizedDecision.normalized : undefined,
        tipo_decision_alias: isLegalTemplate ? normalizedDecision.alias : undefined,
        strict_generation: isLegalTemplate ? true : undefined,
        replaceable_fields: isLegalTemplate ? replaceableFields : undefined,
        storage_warning: uploadResult.warning,
      },
    });

    if (!created) {
      throw new Error("No fue posible guardar el documento en biblioteca");
    }

    const params = new URLSearchParams();
    params.set("profileId", profileId);
    if (uploadResult.warning) {
      params.set("ok", "archivo_importado_con_advertencia");
      params.set("error", uploadResult.warning);
    } else {
      params.set("ok", "archivo_importado_biblioteca");
    }
    return redirectWith(request, params);
  } catch (error) {
    const params = new URLSearchParams();
    params.set("profileId", profileId);
    params.set("error", error instanceof Error ? error.message : "Error importando PDF a biblioteca");
    return redirectWith(request, params);
  }
}
