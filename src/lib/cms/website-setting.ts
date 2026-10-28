/** Website setting jsonb ko seedha matn banao.
 *
 * Purana save `JSON.stringify` dubara karta tha, is liye live value
 * teen hawalay mein band ho sakti hai. Yahan utne hawalay kholte hain
 * jitne hon — data ki qatarein yahin se nahi badalte.
 */
export function unwrapWebsiteSetting(value: unknown): string {
  let current: unknown = value;
  for (let i = 0; i < 8; i += 1) {
    if (typeof current === "number" || typeof current === "boolean") return String(current);
    if (typeof current !== "string") break;
    const trimmed = current.trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }
  return current == null ? "" : String(current);
}

/** Owner ka tasdeeq-shuda dukan number: 0312-6513294. */
export const SHOP_PHONE_DISPLAY = "0312-6513294";
export const SHOP_PHONE_E164 = "+923126513294";
export const SHOP_PHONE_WHATSAPP = "923126513294";

export const CMS_EDITOR_ROLES = ["owner", "super_admin", "admin"] as const;

export function cmsWriteAllowed(role: string | null | undefined, active = true): boolean {
  return Boolean(active) && CMS_EDITOR_ROLES.includes(String(role ?? "") as (typeof CMS_EDITOR_ROLES)[number]);
}

/** Pata abhi nahi diya gaya. Asal pata owner ke baghair nahi bhara jata. */
export function isPlaceholderAddress(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return text.length === 0 || text === "pakistan" || text === "address" || text === "pata";
}

export function addressNeedsOwner(value: unknown): boolean {
  return isPlaceholderAddress(unwrapWebsiteSetting(value));
}
