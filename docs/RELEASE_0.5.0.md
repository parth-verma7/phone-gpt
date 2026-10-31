# PhoneGPT 0.5.0 — Dev / standalone parity

2026-10-31. Android versionCode 14. Parth authorized syncing all current Dev features into standalone production and pushing the code to GitHub. The production freeze is lifted for this release.

## Included in both

- Supplied phone/layers logo in launcher resources, splash screen, Home, App Info and drawer; branded Expo icon config.
- Minimal teal light/dark UI, shared buttons/cards/icons, font scaling and responsive chat controls.
- Live English Whisper transcription, actual microphone meter, selected voice-model label, no visible interval/timer and no former 120-second cutoff. Original record-then-transcribe mode remains behind its feature flag.
- Download background handling and recovery, manual Pause/Resume/Cancel for new transfers, local No internet feedback and persisted checkpoints. Older DownloadManager tasks remain supported and retain their limitations.
- Last loaded chat-model recovery, truthful loaded selection badges, preserved conversations/context and local TXT attachments.
- Explicit scroll to new sent messages, user-controlled stream following, editable next drafts during generation and a Stop control that saves partial output.
- New-chat shortcut, local full-screen history search with highlighted substring matches, and confirmed local chat deletion. Navigation placement/empty-chat reuse follow the latest user request.

The previous standalone was 0.4.3 and did not include these later Dev revisions. Both 0.5.0 builds come from the same source; there are no separate feature branches to copy manually.

## Intentional differences

- Standalone: `PhoneGPT`, `com.phonegpt.app`, embedded JavaScript and offline startup.
- Dev: `PhoneGPT Dev`, `com.phonegpt.app.dev`, Metro/Fast Refresh, Dev-labelled history.
- Each app keeps its own local chats/settings/models. Feature parity does not share or migrate data between them. Compatible updates preserve the data belonging to the same app ID/signing key.
- APKs are local artifacts, not committed to GitHub. Model weights, signing keys and credentials are excluded too.

## Verification

Run `npm test`, `npx tsc --noEmit`, local HTTP fixture tests, then build/test Dev before rebuilding standalone. `scripts/verify-android-builds.py` verifies matching versions, identities, expected embedded release features, packaged icons, native modules, signatures, ZIP integrity and 16 KB ZIP alignment against the prior signing certificate. Re-run the APK size/ELF inspection for each final artifact.

Final local verification completed on 2026-10-31: all nine JS test files, TypeScript, six native HTTP fixture scenarios, Dev browser navigation/draft checks, both Android builds and packaged APK verification passed. All 23 standalone and 25 Dev native libraries pass ELF 16 KB alignment checks; APK ZIP alignment passes too. Physical inference/lifecycle validation remains pending.

Artifacts (decimal MB, not Play download size):

- `PhoneGPT-v0.5.0-standalone.apk`: 63,003,884 bytes (~63.0 MB), SHA-256 `fa0b07792536bea7935e37b03e77d7fac4d58f77f3d977ca35807775f2b79c05`.
- `PhoneGPT-v0.5.0-development.apk`: 102,412,459 bytes (~102.4 MB), SHA-256 `edc030b57531248ca3a2047a3db32dc6b4e279b212088c81c130a109ee289421`.

Phone-specific checks still require the [A54 checklist](A54_TEST_CHECKLIST.md), including app-update data retention, airplane-mode startup, voice/model inference, new transfer pause/background behavior, history search and chat deletion. A successful build does not replace physical testing.

## Still deferred

Accounts/MongoDB, shared Dev/production data, image inference, additional document formats, iOS native delivery, aggressive shrinking/engine removal and store submission. No backend or telemetry added. Play upload signing, privacy/backup decisions and required policy declarations remain separate launch work.
