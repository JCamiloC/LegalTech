/**
 * Crea usuario de prueba en Supabase.
 * Uso: node scripts/create-demo-user.mjs
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY desde .env / .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const DEMO_EMAIL = "demo.tutelas@despacho.test";
const DEMO_PASSWORD = "DemoTutela2026!";
const DEMO_NAME = "Abogado Demo Tutelas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("FAIL: Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await admin.auth.admin.listUsers();
const found = existing?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());

if (found) {
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_NAME },
  });

  if (error) {
    console.error("FAIL:", error.message);
    process.exit(1);
  }

  console.log("OK: Usuario demo actualizado.");
} else {
  const { error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_NAME },
  });

  if (error) {
    console.error("FAIL:", error.message);
    process.exit(1);
  }

  console.log("OK: Usuario demo creado.");
}

console.log("");
console.log("Credenciales de prueba:");
console.log(`  Email:    ${DEMO_EMAIL}`);
console.log(`  Password: ${DEMO_PASSWORD}`);
