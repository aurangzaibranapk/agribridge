const { loadPortalVersion } = require("./portal-version.cjs") as {
  loadPortalVersion: (env?: NodeJS.ProcessEnv) => { version: string; versionCode: number };
};

/** Same rule as src/lib/mobile/channel.ts. Expo config cannot import that .ts file. */
function normalizeChannel(raw: unknown): "debug" | "internal" | "production" {
  if (raw === "debug" || raw === "internal") return raw;
  return "production";
}

export function buildExpoConfig(env: NodeJS.ProcessEnv = process.env) {
  const { version, versionCode } = loadPortalVersion(env);
  const appChannel = normalizeChannel(env.APP_CHANNEL);
  const testFlavor = env.EXPO_PUBLIC_APP_FLAVOR === "test";
  return {
    expo: {
      name: testFlavor ? "AgriBridge TEST" : "AgriBridge",
      slug: testFlavor ? "agribridge-test" : "agribridge",
      version,
      orientation: "portrait",
      userInterfaceStyle: "light",
      backgroundColor: testFlavor ? "#FFF7ED" : "#F3F6F1",
      android: {
        package: testFlavor ? "pk.alranatraders.agribridge.test" : "pk.alranatraders.agribridge",
        versionCode,
        backgroundColor: testFlavor ? "#C2410C" : "#186838",
        permissions: [
          "ACCESS_COARSE_LOCATION",
          "ACCESS_FINE_LOCATION",
          "CAMERA",
          "RECORD_AUDIO",
          "USE_BIOMETRIC",
          "USE_FINGERPRINT",
        ],
      },
      extra: {
        productVersion: version,
        versionCode,
        appChannel,
        appFlavor: testFlavor ? "test" : "live",
        portalUrl: env.EXPO_PUBLIC_PORTAL_URL ?? "",
        supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? "",
        supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      plugins: ["./plugins/withPlaySigning.js", "./plugins/withSideloadApk.js"],
    },
  };
}

export default buildExpoConfig();
