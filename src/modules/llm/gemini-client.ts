const DEFAULT_MODEL = "gemini-3.6-flash";
const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash": DEFAULT_MODEL,
  "gemini-2.0-flash": DEFAULT_MODEL,
  "gemini-2.0-flash-lite": DEFAULT_MODEL,
};

export interface GeminiCallOptions {
  model?: string;
  expectJson?: boolean;
  timeoutMs?: number;
}

export interface GeminiTestResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  sample?: string;
  error?: string;
}

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function getModel(override?: string): string {
  const requested = override?.trim() || process.env.LEGAL_LLM_EXTRACT_MODEL?.trim() || DEFAULT_MODEL;
  return DEPRECATED_MODELS[requested] ?? requested;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getApiKey());
}

export async function callGemini(prompt: string, options?: GeminiCallOptions): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const model = getModel(options?.model);
  const timeoutMs = options?.timeoutMs ?? Number(process.env.LEGAL_LLM_TIMEOUT_MS ?? 60000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxAttempts = 3;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options?.expectJson ? 0 : 0.3,
            responseMimeType: options?.expectJson ? "application/json" : "text/plain",
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 503 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      return text.trim().length > 0 ? text.trim() : null;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Error desconocido");
      if (attempt >= maxAttempts) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Gemini no respondió");
}

export async function testGeminiConnection(): Promise<GeminiTestResult> {
  const model = getModel();
  const started = Date.now();

  if (!isGeminiConfigured()) {
    return {
      ok: false,
      model,
      latencyMs: 0,
      error: "GEMINI_API_KEY no configurada",
    };
  }

  try {
    const sample = await callGemini(
      'Responde exactamente este JSON: {"status":"ok","producto":"tutelas","pais":"Colombia"}',
      { model, expectJson: true, timeoutMs: 20000 }
    );

    if (!sample) {
      return {
        ok: false,
        model,
        latencyMs: Date.now() - started,
        error: "Respuesta vacía de Gemini",
      };
    }

    return {
      ok: true,
      model,
      latencyMs: Date.now() - started,
      sample: sample.slice(0, 200),
    };
  } catch (error) {
    return {
      ok: false,
      model,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
