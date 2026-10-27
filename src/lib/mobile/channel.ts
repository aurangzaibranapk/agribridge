/**
 * App ka build flavor.
 *
 * Masla batayein (tester bug report) sirf debug aur internal par.
 * Jo channel pehchana na jaye wo production hai — galat store build par
 * tester ka button nahi khulta.
 *
 * APP_CHANNEL build ke waqt set hota hai (app.config). Runtime par
 * koi remote flag ise chupke se on nahi karta.
 */

export type AppChannel = "debug" | "internal" | "production";

export function normalizeChannel(raw: unknown): AppChannel {
  if (raw === "debug" || raw === "internal") return raw;
  return "production";
}

/** Tester ka 'Masla batayein' button. */
export function showTesterReport(channel: AppChannel): boolean {
  return channel === "debug" || channel === "internal";
}

/**
 * Production ka support: portal ka LLM chat aur WhatsApp.
 * Tester builds par bhi ye raasta rehta hai; sirf Masla ka button extra hai.
 */
export function showProductionSupport(_channel: AppChannel): boolean {
  return true;
}
