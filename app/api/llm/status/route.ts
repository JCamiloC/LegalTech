import { NextResponse } from "next/server";
import { isGeminiConfigured } from "@/modules/llm/gemini-client";

export const runtime = "nodejs";

function resolveOllamaTagsUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    url.pathname = "/api/tags";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function checkOllama(model: string, endpoint: string) {
  const tagsUrl = resolveOllamaTagsUrl(endpoint);
  if (!tagsUrl || !model) {
    return { status: "disconnected" as const, model, reason: "config_incompleta" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(tagsUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: "disconnected" as const, model, reason: "http_error" };
    }

    const payload = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };

    const models = (payload.models ?? [])
      .map((item) => item.name ?? item.model ?? "")
      .filter((item) => item.length > 0);

    const isInstalled = models.some((name) => name === model || name.startsWith(`${model}:`));

    return {
      status: isInstalled ? ("connected" as const) : ("disconnected" as const),
      model,
      provider: "ollama",
      installed: isInstalled,
    };
  } catch {
    return { status: "disconnected" as const, model, provider: "ollama", reason: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const enabled = String(process.env.LEGAL_LLM_ENABLED ?? "false").toLowerCase() === "true";
  const provider = process.env.LEGAL_LLM_PROVIDER?.trim() || "ollama";
  const extractProvider = process.env.LEGAL_LLM_EXTRACT_PROVIDER?.trim() || provider;
  const model =
    process.env.LEGAL_LLM_EXTRACT_MODEL?.trim() ||
    process.env.LEGAL_LLM_MODEL?.trim() ||
    "gemini-3.6-flash";

  if (!enabled) {
    return NextResponse.json({ status: "disabled", model, provider: extractProvider });
  }

  const useGemini =
    extractProvider === "gemini" || provider === "gemini" || provider === "router";

  if (useGemini) {
    if (!isGeminiConfigured()) {
      return NextResponse.json({
        status: "disconnected",
        model,
        provider: "gemini",
        reason: "missing_api_key",
      });
    }

    return NextResponse.json({
      status: "connected",
      model,
      provider: "gemini",
    });
  }

  const endpoint = process.env.LEGAL_LLM_ENDPOINT?.trim() ?? "";
  const ollamaModel = process.env.LEGAL_LLM_MODEL?.trim() ?? "";
  const ollama = await checkOllama(ollamaModel, endpoint);
  return NextResponse.json(ollama);
}
