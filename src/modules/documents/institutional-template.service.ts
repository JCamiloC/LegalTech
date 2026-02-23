import { readdir } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

interface InstitutionalTemplateVariables {
  radicado: string;
  demandante: string;
  demandado: string;
  tipoProceso: string;
  decision: string;
  fundamento: string;
  cuantia?: number | null;
}

const FORMATOS_DIR = path.join(process.cwd(), "docs", "formatos");

async function resolveInstitutionalDocxPath(): Promise<string | null> {
  try {
    const files = await readdir(FORMATOS_DIR, { withFileTypes: true });
    const docx = files
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".docx"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "es"));

    if (docx.length === 0) {
      return null;
    }

    return path.join(FORMATOS_DIR, docx[0]);
  } catch {
    return null;
  }
}

function replaceSegment(html: string, pattern: RegExp, replacement: string): string {
  return html.replace(pattern, replacement);
}

function formatMoney(value?: number | null): string {
  if (!value || Number.isNaN(Number(value))) {
    return "$0";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function adaptInstitutionalHtml(
  html: string,
  variables: InstitutionalTemplateVariables
): string {
  let adapted = html;

  adapted = replaceSegment(
    adapted,
    /(<p><em>Ej\.\s*para[^<]*n\.?°?\s*)[^<]*(<\/em><\/p>)/i,
    `$1${variables.radicado}$2`
  );

  adapted = replaceSegment(
    adapted,
    /(<p><em>De:\s*)[^<]*(<\/em><\/p>)/i,
    `$1${variables.demandante}. $2`
  );

  adapted = replaceSegment(
    adapted,
    /(<p><em>Contra:\s*)[^<]*(<\/em><\/p>)/i,
    `$1${variables.demandado}. $2`
  );

  adapted = replaceSegment(
    adapted,
    /(Librar mandamiento ejecutivo[^<]*a favor de\s*<strong>)[^<]*(<\/strong>\s*contra\s*<strong>)[^<]*(<\/strong>)/i,
    `$1${variables.demandante}$2${variables.demandado}$3`
  );

  adapted = replaceSegment(
    adapted,
    /(<p>1\.1\)\s*<strong>)[^<]*(<\/strong>\s*por concepto de capital\.)(<\/p>)/i,
    `$1${formatMoney(variables.cuantia)}$2$3`
  );

  const resumenHtml = `
    <section style="border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;margin-bottom:14px;background:#f8fafc;">
      <p style="margin:0 0 6px 0;font-weight:600;">Resumen automático del caso</p>
      <p style="margin:0;">Radicado: <strong>${variables.radicado}</strong> · Proceso: <strong>${variables.tipoProceso}</strong></p>
      <p style="margin:6px 0 0 0;">Decisión sugerida/final: <strong>${variables.decision}</strong></p>
      <p style="margin:6px 0 0 0;">Fundamento: ${variables.fundamento}</p>
    </section>
  `;

  return `${resumenHtml}${adapted}`;
}

export async function buildInstitutionalTemplateHtml(
  variables: InstitutionalTemplateVariables
): Promise<string | null> {
  const templatePath = await resolveInstitutionalDocxPath();

  if (!templatePath) {
    return null;
  }

  const converted = await mammoth.convertToHtml({ path: templatePath });
  const html = converted.value?.trim();

  if (!html) {
    return null;
  }

  return adaptInstitutionalHtml(html, variables);
}
