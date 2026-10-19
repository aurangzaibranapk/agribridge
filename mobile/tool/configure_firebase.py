from pathlib import Path


settings = Path("android/settings.gradle.kts")
app_gradle = Path("android/app/build.gradle.kts")

settings_text = settings.read_text()
plugin_line = '    id("com.google.gms.google-services") version "4.4.4" apply false\n'
if "com.google.gms.google-services" not in settings_text:
    marker = 'plugins {\n'
    if marker not in settings_text:
        raise SystemExit("Android settings plugin block not found")
    settings_text = settings_text.replace(marker, marker + plugin_line, 1)
    settings.write_text(settings_text)

app_text = app_gradle.read_text()
app_plugin_line = '    id("com.google.gms.google-services")\n'
if "com.google.gms.google-services" not in app_text:
    marker = 'plugins {\n'
    if marker not in app_text:
        raise SystemExit("Android app plugin block not found")
    app_text = app_text.replace(marker, marker + app_plugin_line, 1)
    app_gradle.write_text(app_text)
