# PhoneGPT iOS build and parity checklist

Updated 2026-11-03. Source version 0.5.3, iOS build number 17. **iOS source and project preparation are present; no native iOS build, signed IPA or physical iPhone verification has completed.** Android remains the built platform.

## What is available in source

- The same React Native UI, model catalogs, local history, TXT attachments, search/delete, themes/text scaling, prompt controls, token sliders/context tracking, streamed replies and Stop/next draft behavior.
- `ios/`: generated Expo/Xcode project, permission text, icon/splash and embedded-release JS configuration. Deployment target 16.4; actual device and runtime requirements need native validation.
- `modules/phone-gpt-ios/`: an Apple-only Expo module pod. AVAudioEngine/AVAudioConverter capture 16 kHz mono 16-bit PCM, write private WAV files and provide bounded snapshots/audio-energy events to the existing Whisper live-transcription pipeline. Microphone permission uses iOS APIs; no background microphone mode is requested.
- A native background URLSession download manager implements the shared enqueue/state/pause/resume/cancel/delete contract. It persists metadata and resume data, restores tasks, validates completion, handles background-session events and uses bounded retry for transient errors. Invalid resume state is discarded so explicit Retry can start cleanly.
- Separate Debug (`PhoneGPT Dev`, `com.phonegpt.app.dev`) and Release (`PhoneGPT`, `com.phonegpt.app`) identities/deep-link schemes, applied by `plugins/withPhoneGptIOS.js`. Chat/model data is separate between applications and devices; no automatic Android-to-iPhone migration.
- `eas.json` defines cloud Dev and store-build profiles. No Expo project or Apple account has been connected, and no cloud build/upload has been launched.

These are implementation claims about source, not assertions the Swift files compile or the runtime works on an iPhone. CocoaPods/Xcode compilation must be the next validation gate. Swift concurrency/API/interop, microphone conversion/interruption behavior and URLSession recovery remain unverified native risks.

## What an iPhone-only owner needs

An Android APK cannot install on iOS. iPhones require a signed iOS build; TestFlight is the recommended delivery path for this project. Apple Developer Program membership/signing is needed for that distribution path. A development install through a Mac/Xcode is another workflow, but the current owner has an iPhone only.

A Mac does not need to be owned: EAS Build can run the macOS build in the cloud from this Ubuntu workstation. It still needs an Expo account/project and Apple developer/signing setup. Do not enter credentials in a chat; complete the account/signing prompts in the official browser/terminal flow. No enrollment, paid build, certificate creation or third-party upload is performed by the current source-preparation task.

After the owner has those accounts and authorizes cloud build/signing:

```bash
# From the repository, with its dependencies installed.
npx eas-cli login
npx eas-cli build:configure --platform ios
npx eas-cli build --platform ios --profile production
```

Review any project/config changes and resolve native compile errors before distribution. A successful EAS build is not a device acceptance test. When explicitly authorized, submit that signed store build to App Store Connect/TestFlight:

```bash
npx eas-cli submit --platform ios --latest
```

After Apple processing and any applicable beta review, install the TestFlight app on the iPhone and accept the tester invitation. Future standalone updates require a new signed build; no OTA service is configured. EAS/Apple availability, build quotas and distribution requirements should be checked at execution time.

Expo Go cannot host the custom llama/Whisper/recorder/download modules. A Dev iOS build can use Metro/Fast Refresh after one signed installation, just as Android Dev does. It requires registered-device provisioning for the internal distribution workflow; the standalone/TestFlight build embeds JS and can cold-start offline with downloaded models.

## Local checks completed on Ubuntu

- `npm test` and TypeScript checks, including iOS bridge/permission/missing-module and download contract cases.
- `expo prebuild --platform ios --no-install`, leaving the custom Android project intact.
- Apple Expo autolinking resolution includes both native modules and the background session subscriber.
- `scripts/verify-ios-source.py` checks identity, version, permissions, module configuration and embedded release bundle wiring. It does not compile Swift.
- An iOS production Hermes JS export succeeds. A JavaScript bundle is not an installable IPA and does not validate CocoaPods/native linkage.

For macOS local validation after prerequisites are available:

```bash
npm ci
npm run prebuild:ios
npx pod-install ios
npm run ios:dev
```

Use the generated workspace after pod installation. Release must use the Release configuration and embedded bundle; Debug is the separate Dev identity. Do not regenerate Android or overwrite its custom modules while preparing iOS. Commit intentional Podfile.lock after the first verified native pod resolution; none is fabricated on Linux.

## Physical iPhone acceptance

1. **Identity/install:** install Dev and standalone side by side; check names, icons, IDs, correct deep-link routing and independent data. Verify signed updates preserve each app's data.
2. **First-run/layout:** Home, drawer, Models and Settings; notch/home-indicator insets, keyboard, focus and scrolling; light/dark and all font presets; document picker and text selection.
3. **Local chat:** download Tiny/small chat model, load it, exchange a short fact across turns, stream and Stop, type the next draft, read older messages without forced scrolling, switch downloaded models and reload the last model.
4. **Persistence:** restart, reopen chats, search, cancel/confirm deletion and verify original attachments/other chats/models remain. Empty-chat + retains draft/UUID.
5. **Limits/memory:** model GGUF bounds, custom reply/context values and reload behavior. Test a conservative context first. No memory-expansion entitlement is requested; supported model context can exceed the phone's RAM. Current chat/Whisper configurations use CPU; no iPhone GPU-speed claim.
6. **Voice:** allow/deny microphone; select Tiny/Base; record live speech, inspect real energy bars, revise overlapping text, append/edit draft, Stop final audio and Cancel. Test call/audio-route interruptions, lock/background cancellation, repeated sessions and private WAV/snapshot cleanup. There is no 120-second cap; finite file/storage limits remain.
7. **Downloads:** progress normalization; browse other cards/screens; background/lock; offline/reconnect; manual pause/resume; failed checkpoint and fresh Retry; cancel/delete; low storage; process restart. Verify multiple model IDs cannot collide on one destination filename.
8. **iOS lifecycle limits:** background URLSession is system-controlled. User force-quit can cancel/prevent relaunch of transfers; do not promise continued downloads after force-quit or uninstall. Resume data is best effort, not a guarantee the host/system can resume every file.
9. **Offline standalone:** download chat and voice models, stop the development server, enable airplane mode and cold-launch standalone. Run chat/voice/TXT locally with no Metro prompt or network requirement.
10. **Regression/release:** TestFlight on the actual device, native memory/crash reports and signed release behavior must pass before marking feature parity complete. Google Drive remains planning-only on both platforms.

## Native design and storage

iOS models and transfer metadata live under Application Support/PhoneGPT, excluded from OS backup to avoid backing up gigabytes of weights. Resume files are private siblings; final weights move into `models/` only after completion checks. Other local data still uses shared AsyncStorage/private attachment code and platform backup defaults; this change is not a promise that all chat data is excluded from iCloud backup.

Transfer callbacks are isolated on a serial native queue, use generation tokens to ignore stale task callbacks and persist state outside React. Manual pause retains system resume data when available; otherwise resume/retry can restart. Network retry/backoff is bounded and may be deferred by suspension. Capturing live audio and inference remain foreground operations; backgrounding cancels dictation through the shared hook/native recorder lifecycle.

Official references checked 2026-11-02: [Apple distribution](https://help.apple.com/xcode/mac/current/en.lproj/dev31de635e5.html), [device signing](https://help.apple.com/xcode/mac/current/en.lproj/dev5a825a1ca.html), [background downloads](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background), [Expo cloud build setup](https://docs.expo.dev/build/setup/), [Expo native subscribers](https://docs.expo.dev/modules/appdelegate-subscribers/).
