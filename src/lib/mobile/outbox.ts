import { isUuid, type OutboxKind } from "./queue";
import { selfApprovalError } from "../dairy/rules";

const KINDS = new Set<OutboxKind>(["attendance", "meter", "petrol", "pickup", "drop", "fat", "feedback"]);

export function fatActorError(
  actorId: string,
  entry: { created_by?: string | null; mca_profile_id?: string | null }
): string | null {
  return selfApprovalError(actorId, entry.created_by ?? null, entry.mca_profile_id ?? null);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Client ka item server tak jaane se pehle. Photo ka hadd ~1.5MB base64. */
export function validateOutbox(kind: unknown, payload: unknown): { ok: true; kind: OutboxKind; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof kind !== "string" || !KINDS.has(kind as OutboxKind)) return { ok: false, error: "Qisam sahi nahi." };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, error: "Payload sahi nahi." };
  const body = payload as Record<string, unknown>;
  const photo = typeof body.photo_base64 === "string" ? body.photo_base64 : "";
  const voice = typeof body.voice_base64 === "string" ? body.voice_base64 : "";
  if (photo.length > 2_000_000 || voice.length > 2_000_000) return { ok: false, error: "Tasveer ya awaaz 1.5MB se chhoti honi chahiye." };

  if (kind === "attendance") {
    const lat = num(body.lat);
    const lng = num(body.lng);
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { ok: false, error: "Hazri ke liye GPS zaroori hai." };
    }
  }
  if (kind === "meter") {
    const km = num(body.km);
    if (km == null || km < 0) return { ok: false, error: "Meter ka KM sahi likhein." };
    if (photo.length < 20) return { ok: false, error: "Meter ki tasveer laazmi hai." };
  }
  if (kind === "petrol") {
    const liters = num(body.liters);
    if (liters == null || liters <= 0) return { ok: false, error: "Petrol ke litre sahi likhein." };
    if (photo.length < 20) return { ok: false, error: "Bill ki tasveer laazmi hai." };
  }
  if (kind === "pickup") {
    const liters = num(body.liters);
    if (liters == null || liters <= 0) return { ok: false, error: "Litre sahi likhein." };
    if (!body.farmer_code && !body.farmer_id) return { ok: false, error: "Kisan ka code likhein." };
  }
  if (kind === "drop") {
    const liters = num(body.liters);
    if (liters == null || liters <= 0) return { ok: false, error: "Chiller par litre sahi likhein." };
  }
  if (kind === "fat") {
    if (!isUuid(body.entry_id)) return { ok: false, error: "Entry nahi mili." };
    const fat = num(body.fat);
    if (fat == null || fat <= 0) return { ok: false, error: "FAT sahi likhein." };
  }
  if (kind === "feedback") {
    const text = String(body.text ?? "").trim();
    if (text.length < 3) return { ok: false, error: "Masla kam az kam 3 harf mein likhein." };
  }
  return { ok: true, kind: kind as OutboxKind, payload: body };
}
