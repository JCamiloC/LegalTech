export function ensureNonEmpty(value: string, message: string) {
  if (!value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

export function ensureEmail(value: string) {
  const parsed = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(parsed)) {
    throw new Error("Correo electrónico inválido");
  }

  return parsed;
}

export function ensurePassword(value: string, minLength = 6) {
  if (value.length < minLength) {
    throw new Error(`La contraseña debe tener al menos ${minLength} caracteres`);
  }

  return value;
}

export function toNullableString(value: FormDataEntryValue | null): string | null {
  const parsed = String(value ?? "").trim();
  return parsed.length > 0 ? parsed : null;
}

export function toBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

export function parsePositiveNumber(value: FormDataEntryValue | null): number | null {
  const parsed = String(value ?? "").trim();

  if (!parsed) {
    return null;
  }

  const numericValue = Number(parsed);

  if (Number.isNaN(numericValue) || numericValue < 0) {
    throw new Error("Valor numérico inválido");
  }

  return numericValue;
}