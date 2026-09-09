/**
 * Prueba conexión Gemini. Lee GEMINI_API_KEY desde .env / .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename) {
  const filepath = resolve(process.cwd(), filename);
  if (!existsSync(filepath)) {
    return;
  }

  const content = readFileSync(filepath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const requested = process.env.LEGAL_LLM_EXTRACT_MODEL?.trim() || "gemini-3.6-flash";
const deprecated = {
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-flash-lite": "gemini-3.6-flash",
};
const model = deprecated[requested] ?? requested;
const apiKey = process.env.GEMINI_API_KEY?.trim();

if (!apiKey) {
  console.error("FAIL: GEMINI_API_KEY no está definida en el entorno.");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
const started = Date.now();

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: 'Responde JSON: {"status":"ok","test":true}' }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  }),
});

const latencyMs = Date.now() - started;
const body = await response.text();

if (!response.ok) {
  console.error(`FAIL: HTTP ${response.status} (${latencyMs}ms)`);
  console.error(body.slice(0, 500));
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  console.error("FAIL: respuesta no JSON");
  process.exit(1);
}

const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
console.log(`OK: Gemini ${model} respondió en ${latencyMs}ms`);
console.log(`Muestra: ${String(text).slice(0, 120)}`);
