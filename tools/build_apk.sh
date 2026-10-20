#!/bin/bash
# 一键打包安卓 APK：素材转 WebP → 同步进安卓工程 → Gradle 编译 → 复制到 dist/
# usage: bash tools/build_apk.sh [debug|release]   （默认 release，用 app/keystore 里的签名）
set -e
cd "$(dirname "$0")/.."
MODE="${1:-release}"
export JAVA_HOME="${JAVA_HOME:-C:/Users/13857/android-tools/jdk-21.0.12.1+1}"
export ANDROID_HOME="${ANDROID_HOME:-C:/Users/13857/android-tools/sdk}"
# Java 不会自动用系统代理：把 HTTPS_PROXY（例如 http://127.0.0.1:10808）转成 Gradle 的 -D 参数
PROXY=()
if [ -n "$HTTPS_PROXY" ]; then
  hp="${HTTPS_PROXY#*://}"; hp="${hp%/}"; host="${hp%:*}"; port="${hp##*:}"
  PROXY=(-Dhttp.proxyHost=$host -Dhttp.proxyPort=$port -Dhttps.proxyHost=$host -Dhttps.proxyPort=$port)
fi
node tools/build_app.js
node tools/make_icons.js
(cd app && npx cap sync android)
cd app/android
if [ "$MODE" = "debug" ]; then
  ./gradlew.bat assembleDebug --no-daemon "${PROXY[@]}"
  APK=app/build/outputs/apk/debug/app-debug.apk
else
  ./gradlew.bat assembleRelease --no-daemon "${PROXY[@]}"
  APK=app/build/outputs/apk/release/app-release.apk
fi
cd ../..
mkdir -p dist
cp "app/android/$APK" "dist/孤独摇滚-第五条音轨.apk"
ls -la dist/
