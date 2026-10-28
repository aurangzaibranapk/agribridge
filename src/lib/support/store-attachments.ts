import { createServiceClient } from "@/lib/supabase/service";
import { ATTACHMENT_MAX_COUNT, checkAttachment, normalizeImageMime } from "@/lib/support/attachments";

/** Private bucket. Signed URL baad mein, sirf jis ko ticket dikhe. */
export async function storeComplaintImages(input: {
  ticketId: string;
  organizationId: string;
  userId: string;
  files: File[];
}): Promise<{ saved: number; paths: string[]; error?: string }> {
  const files = input.files.filter((file) => file.size > 0);
  if (!input.ticketId || files.length === 0) return { saved: 0, paths: [] };
  const service = createServiceClient();
  const db = service as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> };
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
    storage: { from: (b: string) => { upload: (path: string, file: File, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }> } };
  };
  const existing = await db.from("support_ticket_attachments").select("id").eq("ticket_id", input.ticketId);
  if (existing.error) return { saved: 0, paths: [], error: existing.error.message };
  let count = existing.data?.length ?? 0;
  let saved = 0;
  const paths: string[] = [];
  for (const file of files) {
    const mime = normalizeImageMime(file.type, file.name);
    const problem = checkAttachment({ mime, name: file.name, size: file.size, existingCount: count });
    if (problem) return { saved, paths, error: problem };
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const path = `${input.organizationId}/${input.ticketId}/${crypto.randomUUID()}.${ext}`;
    const uploaded = await db.storage.from("support-evidence").upload(path, file, { contentType: mime, upsert: false });
    if (uploaded.error) return { saved, paths, error: uploaded.error.message };
    const inserted = await db.from("support_ticket_attachments").insert({
      ticket_id: input.ticketId,
      organization_id: input.organizationId,
      uploaded_by: input.userId,
      storage_path: path,
      mime,
      size_bytes: file.size,
    });
    if (inserted.error) return { saved, paths, error: inserted.error.message };
    paths.push(path);
    saved += 1;
    count += 1;
    if (count >= ATTACHMENT_MAX_COUNT) break;
  }
  return { saved, paths };
}
