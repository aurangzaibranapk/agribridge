"""flutter create ke baad Android project ko Play Store ke qaidon par laata hai.

* applicationId/namespace: pk.alranatraders.agribridge (TWA wali hi package)
* targetSdk >= 35 (Google Play 2025+ ki shart), compileSdk >= 35
* Release build ke liye INTERNET permission main manifest mein
  (flutter create sirf debug/profile manifest mein daalta hai)
* App ka naam
Idempotent: dobara chalana mehfooz hai.
"""
import re
from pathlib import Path

APP_ID = "pk.alranatraders.agribridge"
MIN_TARGET = 35
LABEL = "Al Rana AgriBridge"

gradle = Path("android/app/build.gradle.kts")
text = gradle.read_text(encoding="utf-8")
if f'applicationId = "{APP_ID}"' not in text:
    raise SystemExit(f"applicationId {APP_ID} nahi mila; flutter create --org pk.alranatraders --project-name agribridge chalayein")
text = re.sub(r"targetSdk = .*", f"targetSdk = maxOf(flutter.targetSdkVersion, {MIN_TARGET})", text, count=1)
text = re.sub(r"compileSdk = .*", f"compileSdk = maxOf(flutter.compileSdkVersion, {MIN_TARGET})", text, count=1)
gradle.write_text(text, encoding="utf-8")

manifest = Path("android/app/src/main/AndroidManifest.xml")
m = manifest.read_text(encoding="utf-8")
if "android.permission.INTERNET" not in m:
    m = m.replace("<application", '<uses-permission android:name="android.permission.INTERNET"/>\n    <application', 1)
if "android.permission.POST_NOTIFICATIONS" not in m:
    m = m.replace("<application", '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>\n    <application', 1)
m = re.sub(r'android:label="[^"]*"', f'android:label="{LABEL}"', m, count=1)
manifest.write_text(m, encoding="utf-8")
print(f"Android configured: {APP_ID}, targetSdk>={MIN_TARGET}, INTERNET in release manifest")
