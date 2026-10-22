/** Greeting ka pehla lafz "TEST" nahi. Baaqi naam rehta hai. */

export function greetingName(full: string | null | undefined): string {
  const words = cleanPerson(full).split(/\s+/).filter((word) => word && !/^test$/i.test(word));
  if (!words.length) return "";
  if (words.length > 1 && /^app$/i.test(words[0])) return words.join(" ");
  return words[0];
}

/** "(TEST)" hatao. Khali naam khali rehta hai. */
export function cleanPerson(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s*\(TEST\)\s*/gi, " ").replace(/\s+/g, " ").trim();
}

const ROLE_NAME_KEYS: Record<string, string> = {
  Kisan: "home.name.kisan",
  MCA: "home.name.mca",
  "MCO / Chiller": "home.name.mco",
  Admin: "home.name.admin",
  Customer: "home.name.customer",
  Dealer: "home.name.dealer",
  Staff: "home.name.staff",
  Vet: "home.name.vet",
};

/** Role badlo par demo naam ki note key. Asal login par null. */
export function roleNameKey(role: string | null | undefined): string | null {
  return role ? ROLE_NAME_KEYS[role] ?? null : null;
}
