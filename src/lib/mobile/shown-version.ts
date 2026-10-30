/**
 * Phone versionCode this source ships.
 * Web must read this number. Babel inlines Constants.expoConfig once per
 * Metro process and keeps the old AGRIBRIDGE_VERSION_CODE (the footer
 * stayed on 625 after the APK moved to 626). A native APK embeds the
 * manifest at prebuild, and that embedded code is the installed build.
 */
export const PHONE_VERSION_CODE = 647;

export function shownVersionCode(input: {
  platform: string;
  embedded?: number | null;
  phone?: number;
}): number {
  const phone = input.phone ?? PHONE_VERSION_CODE;
  if (input.platform === "web") return phone;
  const embedded = input.embedded;
  if (typeof embedded === "number" && Number.isInteger(embedded) && embedded > 0) return embedded;
  return phone;
}
