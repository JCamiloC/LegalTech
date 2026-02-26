export interface AssistantStoredInteraction {
  id: string;
  case_id: string | null;
  question: string;
  normalized_question: string;
  response_json: {
    resumen: string;
    recomendaciones: string[];
    camposSugeridos: string[];
    articulosRelevantes: Array<{ codigo: string; nombre: string }>;
    reglasRelevantes: Array<{ nombre: string; prioridad: number; resultado: string }>;
    siguientePaso: string;
  };
  helpful: boolean | null;
  feedback_notes: string | null;
  created_at: string;
  updated_at: string;
}
