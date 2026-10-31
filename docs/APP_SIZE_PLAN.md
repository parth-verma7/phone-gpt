# PhoneGPT app-size plan

Measured 2026-10-31. Production artifact is frozen; this audit does not change release configuration or overwrite the standalone APK.

## Baseline

Existing `PhoneGPT-v0.4.3-standalone.apk`: 60,759,380 bytes (60.76 MB, decimal). It contains only arm64-v8a libraries and no model-weight payloads in assets. The Dev APK is about 100.8 MB and is not a useful store-size target.

Standalone ZIP-entry sizes:

- Native libraries: 45.23 MB, stored uncompressed in the APK.
- Java/Kotlin DEX: 21.81 MB raw / 7.96 MB compressed entries.
- JavaScript/assets: 5.31 MB.
- Resources/metadata: 2.41 MB raw / 1.91 MB compressed entries.
- ZIP metadata, signatures and alignment padding account for the remaining bytes.

These are APK measurements, not Google Play download size or installed storage. The AAB upload size is also different from what one user's device downloads. Use Play Console's app-size report after a candidate AAB is available; do not promise a specific minimum in advance.

## Largest contributors

- llama CPU variants: generic 10.69 MB + ARMv8.2 10.75 MB.
- React Native runtime: 6.99 MB.
- Hermes: 2.48 MB.
- Whisper CPU variants: three libraries totaling about 5.17 MB.

Inference engines must be included for downloaded weights to run offline. Models are already downloaded separately. Removing a CPU variant can reduce size but may reduce compatibility or speed; do not blindly delete libraries or fetch executable native code from model hosting.

## Optimization order (future release candidate)

1. Build a production AAB and let Play generate device-specific splits. Existing baseline is already arm64-only, so architecture splitting alone will not eliminate its engine footprint.
2. Enable and test R8 code optimization and resource shrinking in an isolated release candidate. Current properties leave both disabled by default. Use the optimized default rules, audit broad keep rules and retain JNI/reflection requirements. Test model loading, voice, downloads and pickers after shrinking.
3. Remove unused native packages: `expo-image-picker` is installed but the app currently supports TXT attachments only. Check references/autolinking before removal; rebuild and measure. Keep Dev tools in development builds and verify release dependencies rather than assuming the debug size carries over.
4. Audit engine build variants and symbols. Preserve a compatible baseline CPU implementation and benchmark any removal of optimized variants on real devices. Do not trade away chat/voice functionality without a product decision.
5. Keep SVG icons and system fonts; avoid bundled font packs, large images, animation libraries or model weights. Current UI polish adds no new npm dependency.
6. Consider on-demand Play feature delivery for optional voice/runtime components only if simpler measures are insufficient. This needs native modularization and fresh-install/offline tests; it is not equivalent to downloading GGUF model data and is not implemented.

Do not turn on legacy compressed native packaging just to make a local APK look smaller: it can add installed extraction cost. Compare actual Play transfer size, installed storage, cold start, inference speed and battery usage.

## Compatibility checks completed on frozen baseline

- All 23 native ELF files have load-segment alignments of at least 16 KB and divisible by 16 KB.
- Android SDK `zipalign -c -P 16 4` passes.
- These static checks do not replace running on a 16 KB device/emulator or checking the final Play-generated APKs.

## Repeatable inspection

Run `python3 scripts/analyze-apk.py /absolute/path/to/app.apk`. It emits JSON with raw/compressed entry sizes, native library contributions, possible bundled model payloads and ELF load alignment checks. It does not extract, modify or upload the APK.

References: [Android app-size guidance](https://developer.android.com/topic/performance/reduce-apk-size), [R8 optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization), [16 KB compatibility](https://developer.android.com/guide/practices/page-sizes).
