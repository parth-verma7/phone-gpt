# PhoneGPT 0.5.1 — current Dev source in standalone

Built/verified: 2026-11-01. Android version code 15.

## Audit result

The local 0.5.0 standalone APK already contained live-transcription code/UI and the chat/history/download baseline. It lacked the newer token sliders, custom integer inputs, GGUF context-ceiling checks and per-turn reply budgeting. A running Metro server cannot update that standalone APK's embedded application code.

Both 0.5.1 APKs are rebuilt from the current shared source. The only intended Dev-specific application behavior is identity/development guidance and history-origin labels; voice and inference do not have Dev-only feature gates. Dev and production still have separate model files, selections, settings and chats. A voice model selected in Dev is not automatically available in production.

## Included

- Live English Whisper transcription with the current 1000 ms attempted cadence, microphone-energy meter, editable draft merging, Stop/final flush and cancellation cleanup. No visible interval counter or fixed 120-second cap.
- Reply slider/custom input starting at 384; context slider/custom input starting at 1024. Presets are shortcuts, not slider caps. Defaults remain 384 reply / 2048 context.
- GGUF metadata bounds allocation, unknown metadata uses a conservative range, and actual reply budgets fit current input plus a template reserve. Context changes reload after commit.
- All existing shared features: logo/theme/font settings, local streamed chat, Stop/next draft, TXT attachments, local context/history, downloaded-model switching, last-model recovery, history search/deletion, empty-chat reuse and resumable downloads.

## Verification

- Ten JS test files and TypeScript pass; Dev build completed before production build.
- All 44 local application sources in the production packager source map match the checkout; the built voice config is `live` / `1000` ms. The packaged Hermes bundle matches the generated build output.
- APK identities, version/code, release/debug configuration, new feature markers, native voice/recorder/download engines, supplied icons, ZIP integrity and signing compatibility with 0.5.0 pass.
- Standalone ZIP 16 KB alignment and all 23 native ELF alignment checks pass. No model weights are bundled.
- No phone was connected through ADB. Installed-device version, real microphone accuracy/latency, offline cold-start and lifecycle behavior were not verified in this run. Use the [A54 checklist](A54_TEST_CHECKLIST.md).

## Local artifacts and installation

- `PhoneGPT-v0.5.1-standalone.apk`: 63,011,476 bytes (~63.0 MB); SHA-256 `e1d7f93ea51dc0ac8a5756b580bea737e4e56837fdbaaf29d1e809ce5b7246dc`.
- `PhoneGPT-v0.5.1-development.apk`: 102,412,459 bytes (~102.4 MB); SHA-256 `4b491c3f16af1e801a9e70d464d8c137c0d66bb8f18d8b8c58153d319fa05c83`.

Install standalone over the existing PhoneGPT app without uninstalling. Its existing app ID/signing certificate are retained for compatible updates and data retention. Check App Info shows 0.5.1, select a downloaded voice model in production, and test Mic. Standalone needs no Metro; new model downloads require internet.

The existing compatible Dev APK can reload this JavaScript through Metro; the new Dev APK is also available if a matching native version label is desired. No automatic standalone update service or shared storage was added. GitHub publishing remains pending user verification/explicit authorization for these current changes.
