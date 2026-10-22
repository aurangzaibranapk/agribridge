import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadPortalVersion } = require("../apps/mobile/portal-version.cjs");
const { version, versionCode } = loadPortalVersion();

const portalSource = readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
const product = readFileSync(new URL("../src/lib/product-version.ts", import.meta.url), "utf8");
const appConfig = readFileSync(new URL("../apps/mobile/app.config.ts", import.meta.url), "utf8");
const declared = portalSource.match(/export const AGRIBRIDGE_OS_VERSION = "([^"]+)"/);

if (!declared || declared[1] !== version) {
  console.error(`Portal version mismatch. app-version.ts=${declared?.[1]} reader=${version}`);
  process.exit(1);
}
if (!product.includes('AGRIBRIDGE_OS_VERSION as PRODUCT_VERSION')) {
  console.error("PRODUCT_VERSION must re-export AGRIBRIDGE_OS_VERSION.");
  process.exit(1);
}
if (!appConfig.includes("loadPortalVersion(env)") || appConfig.includes('join(__dirname, "../../VERSION")')) {
  console.error("Expo config must read the portal version through loadPortalVersion(env).");
  process.exit(1);
}
if (!portalSource.includes("major * 10000 + minor * 100 + patch")) {
  console.error("versionCode must stay major*10000 + minor*100 + patch.");
  process.exit(1);
}
console.log(`shared version ${version} versionCode ${versionCode}`);
