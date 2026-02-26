import type { AssistantStoredInteraction } from "@/types/assistant";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function overlapScore(reference: string[], target: string[]): number {
  if (reference.length === 0 || target.length === 0) {
    return 0;
  }

  const set = new Set(reference);
  const overlap = target.filter((token) => set.has(token)).length;
  return overlap / Math.max(reference.length, target.length);
}

export interface LearnedHint {
  question: string;
  resumen: string;
  helpful: boolean | null;
  score: number;
}

export class AssistantLearningService {
  static findSimilarHelpfulInteractions(
    question: string,
    interactions: AssistantStoredInteraction[],
    maxItems = 3
  ): LearnedHint[] {
    const sourceTokens = tokenize(question);

    return interactions
      .map((item) => {
        const targetTokens = tokenize(item.normalized_question || item.question);
        const score = overlapScore(sourceTokens, targetTokens);
        return {
          question: item.question,
          resumen: item.response_json?.resumen ?? "Sin resumen",
          helpful: item.helpful,
          score,
        };
      })
      .filter((item) => item.score >= 0.18)
      .sort((a, b) => {
        if ((b.helpful ? 1 : 0) !== (a.helpful ? 1 : 0)) {
          return (b.helpful ? 1 : 0) - (a.helpful ? 1 : 0);
        }

        return b.score - a.score;
      })
      .slice(0, maxItems);
  }
}
