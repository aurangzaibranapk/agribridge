from pathlib import Path

path = Path("android/app/build.gradle.kts")
text = path.read_text(encoding="utf-8")

anchor = "    buildTypes {"
signing = """    signingConfigs {
        create("release") {
            val properties = java.util.Properties()
            properties.load(rootProject.file("key.properties").inputStream())
            keyAlias = properties["keyAlias"] as String
            keyPassword = properties["keyPassword"] as String
            storeFile = file(properties["storeFile"] as String)
            storePassword = properties["storePassword"] as String
        }
    }

"""
if anchor not in text:
    raise SystemExit("Flutter Android signing anchor not found")
text = text.replace(anchor, signing + anchor, 1)
text = text.replace(
    'signingConfig = signingConfigs.getByName("debug")',
    'signingConfig = signingConfigs.getByName("release")',
    1,
)
path.write_text(text, encoding="utf-8")
