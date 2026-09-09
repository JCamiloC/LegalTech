const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_JSON_RETRIES = 1;

interface OllamaGenerateResponse {
  response?: string;
}

interface CallLlmOptions {
  expectJson?: boolean;
  retries?: number;
}

function isEnabled(): boolean {
  return String(process.env.LEGAL_LLM_ENABLED ?? "false").toLowerCase() === "true";
}

function getTimeoutMs(): number {
  const raw = Number(process.env.LEGAL_LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return raw;
}

function getJsonRetries(): number {
  const raw = Number(process.env.LEGAL_LLM_JSON_RETRIES ?? DEFAULT_JSON_RETRIES);
  if (!Number.isFinite(raw) || raw < 0) {
    return DEFAULT_JSON_RETRIES;
  }

  return Math.floor(raw);
}

function shouldUseJsonFormat(expectJson: boolean): boolean {
  if (!expectJson) {
    return false;
  }

  return String(process.env.LEGAL_LLM_USE_JSON_FORMAT ?? "true").toLowerCase() === "true";
}

function normalizeLlmOutput(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^thinking\s*\.\.\.[\s\S]*?done thinking\./i, "")
    .trim();
}

function hasValidJsonPayload(raw: string): boolean {
  const cleaned = normalizeLlmOutput(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    JSON.parse(cleaned);
    return true;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first < 0 || last <= first) {
      return false;
    }

    try {
      JSON.parse(cleaned.slice(first, last + 1));
      return true;
    } catch {
      return false;
    }
  }
}

async function callOllama(prompt: string, options?: CallLlmOptions): Promise<string | null> {
  const endpoint = process.env.LEGAL_LLM_ENDPOINT?.trim();
  const model = process.env.LEGAL_LLM_MODEL?.trim();

  if (!endpoint || !model) {
    return null;
  }

  const expectJson = options?.expectJson ?? false;
  const retries = options?.retries ?? getJsonRetries();
  const guardedPrompt = expectJson
    ? `${prompt}\n\nRegla final obligatoria: responde solo JSON valido en una unica salida, sin bloques markdown ni texto adicional.`
    : prompt;

  try {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            prompt: guardedPrompt,
            stream: false,
            format: shouldUseJsonFormat(expectJson) ? "json" : undefined,
            options: {
              temperature: expectJson ? 0 : undefined,
            },
          }),
          signal: controller.signal,
          cache: "no-store",
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return null;
      }

      let data: OllamaGenerateResponse;
      try {
        data = (await response.json()) as OllamaGenerateResponse;
      } catch {
        continue;
      }

      const text = typeof data.response === "string" ? normalizeLlmOutput(data.response) : "";

      if (!text.length) {
        continue;
      }

      if (!expectJson || hasValidJsonPayload(text)) {
        return text;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function shouldUseGemini(): boolean {
  const provider = process.env.LEGAL_LLM_PROVIDER?.trim() || "ollama";
  const extractProvider = process.env.LEGAL_LLM_EXTRACT_PROVIDER?.trim() || provider;
  return extractProvider === "gemini" || provider === "gemini" || provider === "router";
}

export async function callLlm(prompt: string, options?: CallLlmOptions): Promise<string | null> {
  if (!isEnabled()) {
    return null;
  }

  if (shouldUseGemini()) {
    const { callGemini, isGeminiConfigured } = await import("./gemini-client");
    if (isGeminiConfigured()) {
      return callGemini(prompt, {
        expectJson: options?.expectJson,
        model: process.env.LEGAL_LLM_EXTRACT_MODEL?.trim(),
      });
    }

    const allowOllamaFallback =
      String(process.env.LEGAL_LLM_ALLOW_OLLAMA_FALLBACK ?? "false").toLowerCase() === "true";
    if (!allowOllamaFallback) {
      return null;
    }
  }

  return callOllama(prompt, options);
}
