const { loadPortalVersion } = require("./portal-version.cjs") as {
  loadPortalVersion: () => { version: string; versionCode: number };
};

const { version, versionCode } = loadPortalVersion();

/** Same rule as src/lib/mobile/channel.ts. Expo config cannot import that .ts file. */
function normalizeChannel(raw: unknown): "debug" | "internal" | "production" {
  if (raw === "debug" || raw === "internal") return raw;
  return "production";
}

export function buildExpoConfig(env: NodeJS.ProcessEnv = process.env) {
  const appChannel = normalizeChannel(env.APP_CHANNEL);
  return {
    expo: {
      name: "AgriBridge",
      slug: "agribridge",
      version,
      orientation: "portrait",
      userInterfaceStyle: "light",
      backgroundColor: "#F3F6F1",
      android: {
        package: "pk.alranatraders.agribridge",
        versionCode,
        backgroundColor: "#186838",
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
        appChannel,
        portalUrl: env.EXPO_PUBLIC_PORTAL_URL ?? "",
      },
      plugins: ["./plugins/withPlaySigning.js"],
    },
  };
}

export default buildExpoConfig();
