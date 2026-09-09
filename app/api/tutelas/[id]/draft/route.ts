import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { createDocxBufferFromPlainText } from "@/modules/documents";
import { draftTutelaWord, extractDocxText, readTutelaFlow } from "@/modules/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const tutela = await new CaseService(new CaseRepository(supabase)).getCaseById(id);

  if (!tutela) {
    return NextResponse.json({ error: "Tutela no encontrada" }, { status: 404 });
  }

  const flow = readTutelaFlow(tutela.llm_extraccion_json);
  if (!flow.veredicto_confirmado) {
    return NextResponse.json({ error: "Confirma el veredicto antes de generar el Word." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("template");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Sube un .docx (plantilla o tutela ya respondida)." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".docx")) {
    return NextResponse.json({ error: "El archivo debe ser .docx" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const templateText = await extractDocxText(buffer);
  const draft = await draftTutelaWord({
    tutela,
    templateText,
    templateName: file.name,
  });

  const docx = await createDocxBufferFromPlainText(
    `Borrador tutela ${tutela.radicado}`,
    draft
  );

  return new NextResponse(new Uint8Array(docx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="borrador-tutela-${tutela.radicado}.docx"`,
    },
  });
}
