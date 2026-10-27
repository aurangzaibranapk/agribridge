/**
 * AgriBridge OS product version.
 *
 * Isay har approved release par barhaya jayega. Database schema ya npm
 * package version is product version ka substitute nahi hai.
 */
export const AGRIBRIDGE_OS_VERSION = "v0.6.1 Beta";
export const AGRIBRIDGE_OS_RELEASE = "Login v5 + Party Links + Glassy Wallet Release";

/**
 * Play versionCode, isi version string se.
 * vMAJOR.MINOR.PATCH → MAJOR*10000 + MINOR*100 + PATCH.
 * v0.6.1 Beta = 601. TWA ka versionCode 1 tha, is liye ye us se aage hai.
 * minor aur patch 99 se upar is hisaab ko tod dete hain.
 */
export function versionCodeFor(version: string = AGRIBRIDGE_OS_VERSION): number {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Portal version "${version}" has no x.y.z.`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (minor > 99 || patch > 99) throw new Error("versionCode scheme needs minor and patch under 100.");
  return major * 10000 + minor * 100 + patch;
}
