const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Play upload key repo mein nahi. signing/keystore.properties ho to
 * release usi se sign hota hai. Na ho to sirf debug keystore.
 */
function withPlaySigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("agribridgeKeystoreFile")) return mod;
    const header = `
def agribridgeKeystore = new Properties()
def agribridgeKeystoreFile = rootProject.file("../signing/keystore.properties")
if (agribridgeKeystoreFile.exists()) {
    agribridgeKeystore.load(new FileInputStream(agribridgeKeystoreFile))
}
`;
    let src = mod.modResults.contents.replace("android {", `${header}\nandroid {`);
    src = src.replace(
      "signingConfigs {",
      `signingConfigs {
        release {
            if (agribridgeKeystoreFile.exists()) {
                storeFile file(agribridgeKeystore['storeFile'])
                storePassword agribridgeKeystore['storePassword']
                keyAlias agribridgeKeystore['keyAlias']
                keyPassword agribridgeKeystore['keyPassword']
            }
        }`
    );
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = withPlaySigning;
