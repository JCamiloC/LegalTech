import { renderTemplate, renderTemplateStrict, type TemplateVariables } from "./template.service";
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

export async function createDocxBufferFromTemplate(
  template: string,
  variables: TemplateVariables,
  options?: { strict?: boolean }
): Promise<Buffer> {
  const strict = options?.strict ?? false;
  const renderedHtml = strict
    ? (() => {
        const result = renderTemplateStrict(template, variables);
        if (result.unresolved.length > 0) {
          throw new Error(`Plantilla incompleta. Variables no resueltas: ${result.unresolved.join(", ")}`);
        }

        return result.rendered;
      })()
    : renderTemplate(template, variables);
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

export async function createDocxBufferFromPlainText(title: string, body: string): Promise<Buffer> {
  const lines = body.replace(/\r/g, "\n").split("\n");
  const paragraphs = [
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 28,
          font: "Times New Roman",
        }),
      ],
    }),
    ...lines.map(
      (line) =>
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: line.trim().length > 0 ? line : " ",
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
    ),
  ];

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const arrayBuffer = await Packer.toBuffer(document);
  return Buffer.from(arrayBuffer);
}