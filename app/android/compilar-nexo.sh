#!/usr/bin/env bash
# Compila la biblioteca nativa de Mi Bodega con Nexo (pc/movil) y la deja en jniLibs para el APK.
# La ejecuta Gradle en la compilación automática de GitHub (CI=true). En tu PC no hace falta:
# sin la biblioteca, el APK funciona igual pero sin el grupo de aparatos.
set -euo pipefail
cd "$(dirname "$0")/../../pc"
rustup target add aarch64-linux-android armv7-linux-androideabi
command -v cargo-ndk >/dev/null 2>&1 || cargo install cargo-ndk --locked
cargo ndk -t arm64-v8a -t armeabi-v7a -P 24 \
  -o ../app/android/app/src/main/jniLibs \
  build --release -p mi-bodega-movil
ls -la ../app/android/app/src/main/jniLibs/*
