import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "decision-documents";

export async function uploadDecisionDocument(params: {
  caseId: string;
  decisionId: string;
  fileName: string;
  content: string | Buffer;
  contentType?: string;
}): Promise<string | null> {
  const adminClient = createSupabaseAdminClient();
  const objectPath = `${params.caseId}/${params.decisionId}/${params.fileName}`;

  const { error } = await adminClient.storage.from(BUCKET_NAME).upload(objectPath, params.content, {
    upsert: true,
    contentType: params.contentType ?? "application/octet-stream",
  });

  if (error) {
    return null;
  }

  return objectPath;
}

export async function getSignedDecisionDocumentUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.storage.from(BUCKET_NAME).createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}