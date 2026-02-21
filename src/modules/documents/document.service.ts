import { renderTemplate, type TemplateVariables } from "./template.service";
import { Document, Packer, Paragraph, TextRun } from "docx";

export function buildDocumentPreview(template: string, variables: TemplateVariables): string {
  return renderTemplate(template, variables);
}

export function createDownloadableHtmlDocument(template: string, variables: TemplateVariables): Blob {
  const renderedContent = renderTemplate(template, variables);
  const htmlDocument = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Documento judicial</title></head><body>${renderedContent}</body></html>`;

  return new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function createDocxBufferFromTemplate(template: string, variables: TemplateVariables): Promise<Buffer> {
  const renderedHtml = renderTemplate(template, variables);
  const plainText = htmlToPlainText(renderedHtml);

  const paragraphs = plainText.split("\n").map((line) => {
    const safeLine = line.trim().length > 0 ? line : " ";
    return new Paragraph({
      children: [
        new TextRun({
          text: safeLine,
          size: 24,
        }),
      ],
    });
  });

  const document = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  const arrayBuffer = await Packer.toBuffer(document);
  return Buffer.from(arrayBuffer);
}