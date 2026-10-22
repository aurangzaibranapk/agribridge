#!/usr/bin/env bash
# Confirm a sideload APK is signed, not testOnly, and matches the portal version.
set -euo pipefail

apk="${1:?apk path}"
abi="${2:?armeabi-v7a or arm64-v8a}"
code="${3:?versionCode}"
bt="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}/build-tools/35.0.0"

if [[ ! -x "$bt/aapt" && -f "$bt/aapt" ]]; then
  chmod +x "$bt/aapt" "$bt/apksigner" || true
fi

echo "===== $(basename "$apk") ====="
bytes=$(wc -c < "$apk" | tr -d ' ')
echo "SIZE_BYTES $bytes"
if (( bytes > 25000000 )); then
  echo "SIZE_OVER_25MB $bytes"
else
  echo "SIZE_UNDER_25MB $bytes"
fi

"$bt/apksigner" verify --verbose --print-certs "$apk"

badging=$("$bt/aapt" dump badging "$apk")
echo "$badging"
echo "$badging" | grep -q "package: name='pk.alranatraders.agribridge'"
echo "$badging" | grep -q "versionCode='${code}'"
echo "$badging" | grep -q "versionName='v0.6.1 Beta'"
echo "$badging" | grep -q "native-code: '$abi'"
sdk=$(echo "$badging" | sed -n "s/.*sdkVersion:'\\([0-9]*\\)'.*/\\1/p" | head -1)
echo "MIN_SDK $sdk"
if [[ -z "$sdk" || "$sdk" -gt 26 ]]; then
  echo "minSdk $sdk is above Android 8 (API 26)"
  exit 1
fi

xml=$("$bt/aapt" dump xmltree "$apk" AndroidManifest.xml)
if echo "$xml" | grep -q "testOnly"; then
  echo "android:testOnly is set; phones will refuse this APK"
  echo "$xml" | grep "testOnly"
  exit 1
fi
echo "NO_TEST_ONLY"
echo "VERIFY_OK $abi"
