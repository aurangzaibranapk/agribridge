import { canAssignComplaints } from "@/lib/support/complaint-intake";

export const ATTACHMENT_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const ATTACHMENT_MAX_COUNT = 6;

export function normalizeImageMime(mime: string, name: string): string {
  const raw = mime.toLowerCase().trim();
  if (raw === "image/jpg") return "image/jpeg";
  if ((ATTACHMENT_MIMES as readonly string[]).includes(raw)) return raw;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return raw;
}

/** Null matlab file theek hai. Warna Roman Urdu wajah. */
export function checkAttachment(input: { mime: string; name?: string; size: number; existingCount: number }): string | null {
  const mime = normalizeImageMime(input.mime, input.name ?? "");
  if (!(ATTACHMENT_MIMES as readonly string[]).includes(mime)) return "Sirf PNG, JPEG, WEBP ya GIF.";
  if (input.size <= 0 || input.size > ATTACHMENT_MAX_BYTES) return "Image 8MB se chhoti honi chahiye.";
  if (input.existingCount >= ATTACHMENT_MAX_COUNT) return "Ek ticket par 6 images tak.";
  return null;
}

/**
 * Jo ticket dekh sakta hai wahi tasveer. Admin hamesha.
 * Manager aur admin assistant dashboard ki list dekhte hain.
 * Baqi sirf reporter ya assignee. Ajnabi 403.
 */
export function canSeeComplaintTicket(input: {
  actorId: string;
  actorRole: string;
  reporterId: string;
  assigneeId: string | null;
}): boolean {
  if (!input.actorId) return false;
  if (canAssignComplaints(input.actorRole)) return true;
  if (input.actorRole === "manager" || input.actorRole === "admin_assistant") return true;
  if (input.actorId === input.reporterId) return true;
  if (input.assigneeId && input.actorId === input.assigneeId) return true;
  return false;
}
