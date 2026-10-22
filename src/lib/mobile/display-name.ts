/** Greeting ka pehla lafz "TEST" nahi. Baaqi naam rehta hai. */

export function greetingName(full: string | null | undefined): string {
  const words = String(full ?? "").trim().split(/\s+/).filter((word) => word && !/^test$/i.test(word));
  if (!words.length) return "";
  if (words.length > 1 && /^app$/i.test(words[0])) return words.join(" ");
  return words[0];
}
