# PhoneGPT 0.5.2 — iOS source port and Android parity

2026-11-02. Android version code 16; iOS source build number 16.

Android Dev and standalone are built from the same current source. Existing features, including live transcription, history controls, streaming/Stop and flexible token controls, remain shared. Added iOS project/configuration and an Apple-only local Expo pod for microphone PCM/WAV/snapshots/energy events and background URLSession model download/pause/resume/cancel/delete. Platform bridges select these iOS modules without replacing the Android modules. See the [iOS handoff](IOS_BUILD_AND_TEST.md).

## Verification actually completed

- Ten JS test files and TypeScript pass, with added iOS native-module/permission/download bridge cases.
- Expo iOS prebuild and Apple-module autolinking resolve both custom modules and the background subscriber.
- iOS configuration/source checks and a production Hermes JavaScript export pass.
- Android Dev built before standalone; 44 application build-input sources match the checkout. Embedded features, live-mode config/1000 ms cadence, identities, version/code, icons, native modules, signatures and ZIP checks pass. Standalone has 23 aligned native ELF libraries and passes 16 KB ZIP alignment. No weights bundled.

## Not completed

CocoaPods resolution, Swift/native iOS compilation, Xcode archive, signing, IPA/TestFlight distribution and physical iPhone tests. A JS bundle is not an installable iOS application. The owner has an iPhone only; cloud build is configured but no Expo/Apple developer setup was provided or used. No third-party build/upload/account operation was launched. Actual iOS feature parity remains a test target, not a shipped claim.

Android physical regression/update/offline checks also remain on the A54 checklist. No Google Drive functionality was activated. Current changes remain local pending user verification/explicit publishing authorization.

## Local Android artifacts

- `PhoneGPT-v0.5.2-standalone.apk`: 63,011,588 bytes (~63 MB), SHA-256 `f0c99ce211737ca442aca88cadde3a86938290554238eb5a93d8a6d0925df346`.
- `PhoneGPT-v0.5.2-development.apk`: 102,412,459 bytes (~102.4 MB), SHA-256 `540fa8d8b3390e84a7ccf2cfcb83db5fa2517d84564eac430f19477db6a89f0b`.

These are Android-only APKs. Install over the matching existing Android app without uninstalling to retain data. There is no signed iOS download yet. TestFlight requires an Apple-signed iOS build; Android APKs cannot run on iPhone.
