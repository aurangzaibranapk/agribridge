const { readFileSync } = require("node:fs");
const { join } = require("node:path");

/** Expo config .ts import nahi kar sakta. Yahi reader portal ki VERSION string padhta hai. */
function readPortalVersion(source) {
  const match = source.match(/export const AGRIBRIDGE_OS_VERSION = "([^"]+)"/);
  if (!match) throw new Error("AGRIBRIDGE_OS_VERSION src/lib/app-version.ts mein nahi mila.");
  return match[1];
}

/** src/lib/app-version.ts versionCodeFor ke barabar. Test dono ko milata hai. */
function versionCodeFor(version) {
  const match = String(version).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Portal version "${version}" has no x.y.z.`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (minor > 99 || patch > 99) throw new Error("versionCode scheme needs minor and patch under 100.");
  return major * 10000 + minor * 100 + patch;
}

function loadPortalVersion() {
  const source = readFileSync(join(__dirname, "../../src/lib/app-version.ts"), "utf8");
  const version = readPortalVersion(source);
  return { version, versionCode: versionCodeFor(version) };
}

module.exports = { readPortalVersion, versionCodeFor, loadPortalVersion };
