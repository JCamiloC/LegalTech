import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { isVeredicto, persistFlow, readTutelaFlow, type TutelaVeredicto } from "@/modules/llm";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const tutela = await caseService.getCaseById(id);

  if (!tutela) {
    return NextResponse.json({ error: "Tutela no encontrada" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { veredicto?: string };
  const flow = readTutelaFlow(tutela.llm_extraccion_json);
  const veredicto: TutelaVeredicto = isVeredicto(body.veredicto) ? body.veredicto : flow.veredicto;

  if (veredicto === "pendiente") {
    return NextResponse.json({ error: "Aún no hay veredicto para confirmar." }, { status: 400 });
  }

  flow.veredicto = veredicto;
  flow.veredicto_confirmado = true;

  await caseService.updateCase(id, {
    llm_extraccion_json: persistFlow(tutela.llm_extraccion_json, flow),
  });

  const mapped =
    veredicto === "admitir"
      ? "auto_admisorio"
      : veredicto === "rechazar"
        ? "auto_rechaza_demanda"
        : "auto_inadmisorio";
  await new CaseRepository(supabase).setFinalDecision(id, mapped);

  return NextResponse.json({ flow });
}
