import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { KnowledgeRepository } from "@/modules/knowledge";
import { persistFlow, readTutelaFlow, runTutelaChatTurn } from "@/modules/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

async function loadTutela(id: string) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const tutela = await caseService.getCaseById(id);
  return { supabase, caseService, tutela };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { tutela } = await loadTutela(id);
  if (!tutela) {
    return NextResponse.json({ error: "Tutela no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ flow: readTutelaFlow(tutela.llm_extraccion_json) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, caseService, tutela } = await loadTutela(id);
  if (!tutela) {
    return NextResponse.json({ error: "Tutela no encontrada" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { message?: string; bootstrap?: boolean };
  const flowState = readTutelaFlow(tutela.llm_extraccion_json);

  if (body.bootstrap && flowState.messages.length > 0) {
    return NextResponse.json({ flow: flowState });
  }

  const documents = await new KnowledgeRepository(supabase).listActiveDocuments(18);
  const result = await runTutelaChatTurn({
    tutela,
    documents,
    userMessage: body.bootstrap ? null : body.message ?? "",
  });

  if (result.error && result.flow.messages.length === flowState.messages.length) {
    return NextResponse.json({ flow: result.flow, error: result.error }, { status: 503 });
  }

  await caseService.updateCase(id, {
    llm_extraccion_json: persistFlow(tutela.llm_extraccion_json, result.flow),
  });

  if (tutela.estado === "pendiente") {
    const mapped =
      result.flow.veredicto === "admitir"
        ? "auto_admisorio"
        : result.flow.veredicto === "rechazar"
          ? "auto_rechaza_demanda"
          : "auto_inadmisorio";
    await new CaseRepository(supabase).setSuggestedDecision(id, mapped);
  }

  return NextResponse.json({ flow: result.flow, error: result.error });
}
