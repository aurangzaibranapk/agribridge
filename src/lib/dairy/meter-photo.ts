import { createServiceClient } from "@/lib/supabase/service";
import { METER_BUCKET, meterObjectPath } from "@/lib/dairy/rules";

/** Private bucket. Link ek ghante ka hai, jaise LR ki photo. */
export async function signMeterPhoto(stored: string | null | undefined, seconds = 3600): Promise<string | null> {
  const path = meterObjectPath(stored);
  if (!path) return null;
  try {
    const service = createServiceClient();
    const { data, error } = await service.storage.from(METER_BUCKET).createSignedUrl(path, seconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function signMeterFields<T extends Record<string, unknown>>(rows: T[], fields: (keyof T)[]): Promise<T[]> {
  return Promise.all(rows.map(async (row) => {
    const next = { ...row };
    for (const field of fields) {
      const value = row[field];
      if (typeof value === "string" || value == null) {
        (next as Record<string, unknown>)[field as string] = await signMeterPhoto(value as string | null);
      }
    }
    return next;
  }));
}
