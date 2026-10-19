#!/usr/bin/env bash
# APK ka package aur targetSdk jaanchta hai (Play: targetSdk >= 35).
set -euo pipefail
apk="$1"
aapt2="$(ls -d "${ANDROID_HOME:-$ANDROID_SDK_ROOT}"/build-tools/*/aapt2 | sort -V | tail -1)"
badging="$("$aapt2" dump badging "$apk")"
echo "$badging" | grep -E "^package:|targetSdkVersion|application-label:"
echo "$badging" | grep -q "package: name='pk.alranatraders.agribridge'" || { echo "::error::applicationId ghalat"; exit 1; }
target="$(echo "$badging" | sed -n "s/^targetSdkVersion:'\([0-9]*\)'.*/\1/p")"
[ "${target:-0}" -ge 35 ] || { echo "::error::targetSdk $target < 35"; exit 1; }
echo "$badging" | grep -q "android.permission.INTERNET" || { echo "::error::INTERNET permission nahi"; exit 1; }
echo "APK theek: targetSdk=$target"
