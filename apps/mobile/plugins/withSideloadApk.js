const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Sideload test APKs: one per phone ABI, R8 on, still signed with the
 * debug keystore. Off unless Gradle is passed -PagribridgeSideload=true,
 * so the plain debug APK build stays one fat package.
 */
const SNIPPET = `
// agribridgeSideloadSplits
if ((findProperty("agribridgeSideload") ?: "false").toBoolean()) {
    android {
        buildTypes {
            release {
                minifyEnabled true
                shrinkResources true
                signingConfig signingConfigs.debug
                proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            }
        }
        splits {
            abi {
                enable true
                reset()
                include "armeabi-v7a", "arm64-v8a"
                universalApk false
            }
        }
    }
}
`;

function withSideloadApk(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("agribridgeSideloadSplits")) return mod;
    mod.modResults.contents += SNIPPET;
    return mod;
  });
}

module.exports = withSideloadApk;
