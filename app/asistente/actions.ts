"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { LegalArticlesRepository } from "@/modules/legal";
import { RuleRepository } from "@/modules/rules";
import { LocalLegalLlmService } from "@/modules/llm";
import {
  AssistantLearningService,
  AssistantMemoryRepository,
  ExpertAssistantService,
} from "@/modules/expert";

function normalizeQuestion(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function consultAssistantAction(formData: FormData) {
  const rawQuestion = String(formData.get("q") ?? "").trim();
  const caseIdRaw = String(formData.get("caseId") ?? "").trim();
  const caseId = caseIdRaw.length > 0 ? caseIdRaw : null;

  if (!rawQuestion) {
    redirect(`/asistente?error=${encodeURIComponent("Debes ingresar una pregunta")}`);
  }

  const supabase = await createSupabaseServerClient();
  const caseRepository = new CaseRepository(supabase);
  const caseService = new CaseService(caseRepository);
  const legalRepository = new LegalArticlesRepository(supabase);
  const ruleRepository = new RuleRepository(supabase);
  const memoryRepository = new AssistantMemoryRepository(supabase);

  const assistant = new ExpertAssistantService({
    getCaseById: (id) => caseService.getCaseById(id),
    getChecklist: (id) => caseService.getLatestChecklist(id),
    listActiveRules: () => ruleRepository.listActiveRules(),
    listLegalArticles: () => legalRepository.listAll(),
  });

  const [baseResponse, recentInteractions, rules, articles] = await Promise.all([
    assistant.answer({ question: rawQuestion, caseId: caseId ?? undefined }),
    memoryRepository.listRecent(200),
    ruleRepository.listActiveRules(),
    legalRepository.listAll(),
  ]);

  const llmResponse = await LocalLegalLlmService.enrichResponse({
    caseId: caseId ?? undefined,
    question: rawQuestion,
    baseResponse,
    rules,
    articles,
  });

  const effectiveResponse = llmResponse ?? baseResponse;

  const learnedHints = AssistantLearningService.findSimilarHelpfulInteractions(
    rawQuestion,
    recentInteractions,
    3
  );

  const recommendations = [...effectiveResponse.recomendaciones];

  if (learnedHints.length > 0) {
    recommendations.unshift(
      `Memoria interna: se encontraron ${learnedHints.length} consultas similares en el histórico del asistente.`
    );
  }

  const stored = await memoryRepository.create({
    case_id: caseId,
    question: rawQuestion,
    normalized_question: normalizeQuestion(rawQuestion),
    response_json: {
      ...effectiveResponse,
      recomendaciones: recommendations,
    },
  });

  if (!stored) {
    redirect(`/asistente?error=${encodeURIComponent("No fue posible guardar la interacción del asistente")}`);
  }

  const query = new URLSearchParams();
  query.set("interactionId", stored.id);
  query.set("ok", "consulta_registrada");
  if (caseId) {
    query.set("caseId", caseId);
  }

  redirect(`/asistente?${query.toString()}`);
}

export async function rateAssistantInteractionAction(interactionId: string, helpful: boolean, formData: FormData) {
  const feedbackNotes = String(formData.get("feedback_notes") ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const memoryRepository = new AssistantMemoryRepository(supabase);
  const interaction = await memoryRepository.findById(interactionId);

  if (!interaction) {
    redirect(`/asistente?error=${encodeURIComponent("Interacción no encontrada para registrar feedback")}`);
  }

  await memoryRepository.updateFeedback(interactionId, helpful, feedbackNotes || null);

  const query = new URLSearchParams();
  query.set("interactionId", interactionId);
  query.set("ok", helpful ? "feedback_util" : "feedback_no_util");
  if (interaction.case_id) {
    query.set("caseId", interaction.case_id);
  }

  redirect(`/asistente?${query.toString()}`);
}
