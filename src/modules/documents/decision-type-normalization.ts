export type CanonicalDecisionType =
  | "auto_admisorio"
  | "auto_inadmisorio"
  | "mandamiento_pago"
  | "auto_rechaza_demanda"
  | "general";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATCHERS: Array<{ type: CanonicalDecisionType; patterns: RegExp[] }> = [
  {
    type: "auto_inadmisorio",
    patterns: [
      /auto\s+inadmisorio/,
      /inadmisor/,
      /inadmisio?n/,
      /no\s+admite\s+demanda/,
    ],
  },
  {
    type: "auto_admisorio",
    patterns: [
      /auto\s+admisorio/,
      /admisor/,
      /admite\s+demanda/,
    ],
  },
  {
    type: "mandamiento_pago",
    patterns: [
      /mandamiento\s+de\s+pago/,
      /mandamiento\s+pago/,
      /librar\s+mandamiento/,
    ],
  },
  {
    type: "auto_rechaza_demanda",
    patterns: [
      /rechaza\s+demanda/,
      /auto\s+de\s+rechazo/,
      /rechazo\s+demanda/,
    ],
  },
];

export function normalizeDecisionType(value: string): {
  normalized: CanonicalDecisionType;
  alias: string;
} {
  const alias = String(value ?? "").trim();
  const cleaned = normalizeText(alias);

  if (!cleaned) {
    return {
      normalized: "general",
      alias,
    };
  }

  for (const item of MATCHERS) {
    if (item.patterns.some((pattern) => pattern.test(cleaned))) {
      return {
        normalized: item.type,
        alias,
      };
    }
  }

  if (
    cleaned === "auto_admisorio" ||
    cleaned === "auto_inadmisorio" ||
    cleaned === "mandamiento_pago" ||
    cleaned === "auto_rechaza_demanda" ||
    cleaned === "general"
  ) {
    return {
      normalized: cleaned as CanonicalDecisionType,
      alias,
    };
  }

  return {
    normalized: "general",
    alias,
  };
}
