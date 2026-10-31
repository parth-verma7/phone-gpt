# PhoneGPT

PhoneGPT downloads models and runs chat and English voice transcription on the phone. Conversations, attachments and preferences stay in app-local storage; there is no chat backend or mandatory account. React Native targets Android and iOS; the implemented native build and main physical test target are Android / Samsung A54.

Start with [PROJECT_TRACKER.md](PROJECT_TRACKER.md), the [A54 test checklist](docs/A54_TEST_CHECKLIST.md), and the [Play Store release plan](docs/PLAY_STORE_RELEASE_PLAN.md). Last reviewed: **2026-10-31**. Optional email/password accounts remain a future [proposal](docs/AUTHENTICATION_PLAN.md); no account database is provisioned.

## Version and build status

- Current app/source version: **0.5.0**, Android version code **14**. Dev and standalone production use the same feature code and supplied logo.
- **PhoneGPT** (`com.phonegpt.app`): `PhoneGPT-v0.5.0-standalone.apk`, embedded Hermes application code, no Metro needed for startup. After downloading the required models, chat and voice run locally without Wi-Fi. Physical offline validation remains on the device checklist.
- **PhoneGPT Dev** (`com.phonegpt.app.dev`, version name `0.5.0-dev`): `PhoneGPT-v0.5.0-development.apk`. Uses Metro on port 8083 for JavaScript updates. Separate application identity, development tooling and independent chats/models/settings; new Dev history entries keep their `Dev -` prefix.
- Both builds include the teal light/dark UI, font scaling, loaded-model recovery, live transcription and microphone meter, resumable Pause/Resume/Cancel downloads, editable next drafts during generation, Stop, local history search and confirmed chat deletion. Search is beside Chat History in the drawer, and New chat reuses an already empty draft. See [0.5.0 release notes](docs/RELEASE_0.5.0.md) for parity details and verification.
- SDK: **Expo 57** (installed Expo **57.0.30**), React Native **0.86.3**, React **19.2.3**. Old SDK 54 instructions are historical. **Expo Go cannot run the custom inference, recording and download modules.**
- APKs use the existing local signing certificate so compatible updates preserve each installed app's data. Keep signing material private and unchanged for these local installations; a Play Store upload/signing workflow is still a separate release task. APK files, model weights, local SDK/JDK and secrets are excluded from Git.
- Source-only changes reach Dev through Metro; the standalone APK must be rebuilt. Native dependencies/resources/permissions require updated APKs for either app. The supplied artwork is `assets-phonegpt-icon.png`; `scripts/generate-branding.py` packages launcher/splash sizes, and Expo config plus in-app Home/About/drawer use the same image.
- There is no hosted analytics/crash-reporting SDK. Verification uses local diagnostics, visible errors, regression tests and device feedback. Android OS backup remains enabled and needs an explicit privacy/release decision.
- Archived `PhoneGPT-v0.4.3-standalone.apk` remains a historical 60.76 MB baseline. See [size measurements and optimization plan](docs/APP_SIZE_PLAN.md); no model weights are bundled. The prior production freeze has been lifted for the authorized 0.5.0 sync.

## Voice typing (Android)

Download a model from Models → Voice, then tap **Use for voice typing**. The choice is saved separately from the chat model. In Chat, tap the microphone beside Send and speak English. **Live transcription is enabled**: Whisper is loaded once before recording, and the app attempts an update every one second. The latest dictated words can be revised as more audio arrives. Tap Stop to flush remaining audio. Nothing is sent automatically. Sending and model switching are blocked while voice processing is active, but the draft remains editable.

Feature flag: `src/config/voice.ts`, `VOICE_TRANSCRIPTION_MODE = 'live'`. Change it to `'recording'` and rebuild the standalone APK to restore the preserved record-then-transcribe path. `LIVE_TRANSCRIPTION_INTERVAL_MS = 1000`. This is an attempted cadence, not a guaranteed one-second latency; inference may take longer on the phone.

Implementation: continuous private WAV recording with native snapshots capped at 12 seconds and a one-second overlap between windows. Only one transcription runs at a time; busy timer ticks coalesce, and Stop drains unprocessed audio. Recent-window text is revised in place; boundary word matching reduces duplicate overlap. Typed text before/after dictation is preserved. Editing within dictated text freezes those words and appends later speech. A simple audio-energy gate skips silence; it is not a neural speech detector. Quiet speech, noise, boundary-word duplication and accuracy need phone testing. This is windowed Whisper decoding, not diffusion.

Available models from [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp), converted for [whisper.rn](https://github.com/mybigday/whisper.rn): Tiny English (77,704,715 bytes), Base English (147,964,211 bytes), Small English Q5_1 (190,098,681 bytes), Small English (487,614,201 bytes). Start with Tiny or Base on a phone. These are `.bin` Whisper weights, separate from GGUF chat models; raw Transformers weights such as `openai/whisper-small` are not loaded by this runtime. All four use English; no language selector or translation is enabled.

- Native code: `PhoneGptRecorderModule.kt`, registered with the existing custom package; records 16 kHz mono signed 16-bit PCM in a WAV under private `cache/voice/`.
- No fixed recording duration limit. The live UI shows no interval or elapsed-time counter. Stop processes any remaining audio with an “Updating transcript…” status. Removing the former native cap requires the updated Dev APK. Leaving a chat, opening its drawer, backgrounding, cancelling or unmounting cancels active voice typing. Audio is deleted after success, failure or cancellation, and orphan recordings are removed at the next recording start. Only text enters the draft and later chat history if sent.
- In live mode Whisper is initialized before recording and released on completion/cancel; the preserved recording mode initializes it after Stop. The downloaded chat model remains loaded. Small models require more memory and processing time than Tiny/Base; storage sizes are not RAM estimates.
- `whisper.rn` **0.7.4** supplies local transcription; `buffer` **6.0.3** supplies the Buffer dependency needed by its JavaScript wrapper. Runtime imports are lazy so opening the app with an older APK does not immediately crash; pressing Mic explains that the new voice APK is required.
- New native runtime, microphone permission and version require an APK rebuild/reinstall. Expo Go and the older native APK cannot run voice typing. A development APK still needs Metro for JavaScript. Android is implemented; iOS needs a native recorder and device validation.
- Tests: `npm test` (live/recorded voice, one-second scheduling, overlapping windows, draft edits, cancellation, microphone level lifecycle, last-model persistence and text scaling), `npm run test:voice`, `npx tsc --noEmit`, Android bundling, native build. Physical A54 recording/permission/quality/backgrounding/upgrade checks remain pending user verification.

## Publishing workflow

After each important change, finish automated checks and have Parth verify the result on his phone. Commit and push to `parth-verma7/phone-gpt` only after his verification. Voice and standalone changes are awaiting phone verification; do not automatically publish them.

## Implemented behavior

- Welcome homepage; navigation drawer slides in from the left and slides back out when dismissed; navigation to fresh Chat, Models, Settings and App Info; scrollable saved chat history.
- Streamed local responses through `llama.rn`, with conversation history supplied on every turn. Generation uses inline feedback and prevents overlapping sends.
- UUID in the chat header and a downloaded-model dropdown below it; selecting an installed model loads it without clearing the current conversation. Switching is blocked during generation/loading. History shows the first-message preview and the conversation's start date/time.
- Model download/load/delete controls, free-space checks, provider/model accordions and cancel buttons. New Android downloads use the app-owned native resumable service independently of the selected UI card; legacy DownloadManager transfers remain readable.
- Selectable messages with headings, bold, inline code and list formatting; bounded long-message layout, keyboard/safe-area handling and automatic scrolling/focus.
- Live local token streaming into one reply bubble, including reasoning emitted by the model (no reasoning filter). Stream updates stay in UI state; completed replies and partial replies on errors are saved to chat history. Reasoning controls request model behavior and support varies by model.
- Shared generation preferences in Settings and Models, disabled while generating or loading/checking a model. Reasoning choices off/short/extended; output budgets **192, 384, 512, 768** tokens; app context settings **1024, 2048, 4096** tokens. These limits describe the app's controls, not model-family maximums. Reasoning behavior depends on model/template support.
- The visible context tracker counts the current conversation, including file content, and excludes hidden system instructions. It is not a complete measure of model memory or prompt-template overhead.
- Persistent light/dark theme and a saved System Prompt field. A new chat snapshots the saved prompt at its first send; later turns reuse it as a hidden system-role message before the conversation. Existing chats retain their prompt. Blank uses the default assistant prompt, currently named **Parth**.
- App Info includes the app version, local processing/storage details, TXT support, development-build offline requirements and founder biography.
- Android Back: open drawer → Chat; secondary screen → Chat; Chat → Home; Home → system exit.

The catalog has 13 downloadable variants, grouped under Qwen, LLaMA, SmolLM, DeepSeek and Gemma. Each family contains nonempty Censored and/or Uncensored subgroups, using the explicit `censorship` field in `models.json`. All family and subgroup dropdowns start closed when entering Models; individual model options also reset closed. Censored identifies the standard releases in this catalog, and Uncensored identifies community uncensored/abliterated releases; these labels are not guarantees about every response. Existing standard models remain available alongside these community uncensored/abliterated variants:

- Null-Guard Qwen3 0.6B Uncensored: Q4_K_M (397 MB), Q5_K_M (444 MB).
- Huihui Qwen3 1.7B Abliterated v2: Q4_K_M (1.11 GB), Q5_K_M (1.26 GB).
- Llama 3.2 1B Instruct Uncensored: i1-Q4_K_M (808 MB), i1-Q5_K_M (912 MB); mradermacher's imatrix GGUF conversions of nicoboss's fine-tune.
- Llama 3.2 3B Instruct Abliterated: Q4_K_M (2.02 GB), from QuantFactory.
- DeepSeek R1 Distill Qwen 1.5B Uncensored: Q5_K_M (1.29 GB), Q8_0 (1.89 GB); mradermacher's GGUF conversions of thirdeyeai's fine-tune.

Hugging Face API download activity checked on 2026-10-25 (repository-level downloads in the last month, not per-file counts): [Null-Guard GGUF](https://huggingface.co/Null-Guard/Qwen3-0.6B-Uncensored-GGUF) 1,984; [Huihui GGUF](https://huggingface.co/mradermacher/Huihui-Qwen3-1.7B-abliterated-v2-GGUF) 1,726; [Llama 1B GGUF](https://huggingface.co/mradermacher/Llama-3.2-1B-Instruct-Uncensored-i1-GGUF) 6,280; [Llama 3B GGUF](https://huggingface.co/QuantFactory/Llama-3.2-3B-Instruct-abliterated-GGUF) 16,280; [DeepSeek GGUF](https://huggingface.co/mradermacher/DeepSeek-R1-Distill-Qwen-1.5B-uncensored-GGUF) 2,893. These are dated adoption signals, not quality guarantees. All seven newly added variant download URLs returned HTTP 200; sizes in JSON use the API's exact byte counts. Null-Guard's generic remote filenames are stored under unique descriptive local filenames.

The added entries reuse existing download, load, delete and downloaded-model selection controls. Device memory requirements, chat templates, output quality and compatibility still need a complete phone validation pass. Size figures above describe storage, not RAM requirements; `minFreeBytes` is a free-storage check. Uncensored/abliterated labels reflect creator descriptions. Image capability labels describe the model family; **current attachment/inference support is text and TXT only**.

Settings includes a persistent global text-size choice: **0.5×, 0.8×, Default (1×), 1.2×, 1.5×**. It applies immediately to chat, input, menus and other screens. Native icons and touch targets retain their sizes. Recording shows a microphone level meter driven by actual PCM audio energy, with no bars below the noise floor; stale levels are cleared.

## Libraries

Versions below are the installed local versions at this review. `package.json` records allowed dependency ranges; `package-lock.json` records resolved versions. Use `npm ci` to reproduce the lockfile rather than upgrading packages incidentally.

Runtime:

- `expo` **57.0.30** — Expo SDK/runtime and CLI integration.
- `react-native` **0.86.3**, `react` **19.2.3** — native application and component framework.
- `llama.rn` **0.13.0-rc.7** — native llama.cpp model loading, tokenization and inference.
- `@react-native-async-storage/async-storage` **2.2.0** — local JSON conversations and preferences.
- `expo-file-system` **57.0.7** — private files, attachments and file/download helpers.
- `expo-document-picker` **57.0.3** — native TXT file selection.
- `expo-image-picker` **57.0.20** — installed native dependency; current TXT-only attachment flow does not use it. Image chat is deferred.
- `expo-dev-client` **57.0.20** — custom native development launcher.
- `expo-build-properties` **57.0.22** — native build configuration.
- `react-native-safe-area-context` **5.7.0** — device safe areas.
- `react-native-svg` **15.15.4** — SVG UI icons.
- `react-dom` **19.2.3**, `react-native-web` **0.21.4**, `@expo/metro-runtime` **57.0.17** — browser UI development/runtime support.

Development:

- `typescript` **5.9.3** — type checking.
- `@types/react` **19.1.17** — React types.
- `@expo/ngrok` **4.1.3** — optional development tunneling.

Keep Expo native dependencies aligned using `npx expo install <package>` and check with `npx expo install --check`. A previous picker crash (`AnyTypeProvider` missing) came from incompatible native Expo package versions; changing JavaScript alone cannot repair an incompatible installed APK.

## Standalone Android app

The standalone build is an arm64 release APK for phones such as Samsung A54. Its build command selects the generic and ARMv8.2 FP16 llama.cpp variants (`rnllama,rnllama_v8_2`); the runtime selects FP16 when supported and falls back to the generic library on other ARM64 devices. This avoids compiling and packaging every CPU-feature variant. It bundles `assets/index.android.bundle` (Hermes bytecode), local assets, llama.rn and Whisper native libraries. `MainApplication.kt` explicitly uses the bundle asset and enables development-server support only for debug builds. Expo Updates is disabled; startup does not need a code download or server URL.

The v0.4.3 release build passed on 2026-10-31. APK checks confirmed ZIP integrity, embedded Hermes bytecode containing v0.4.3 and live-transcription UI, a non-debuggable manifest, direct `MainActivity` launch, microphone permission, native chat/voice/download/recorder modules including the audio snapshot method, and a signing certificate matching v0.4.2. All 40 regression tests and TypeScript checks pass. The APK has not been installed or tested for live microphone quality, latency or airplane-mode operation on a physical phone. SHA-256: `28a9174633938a1e6a1ed64cc2c36c3b0cdf57061be97f0210d3b8233dbec384`.

Install it **over** the existing PhoneGPT app rather than uninstalling. Package ID and the local signing key are retained to support an in-place update with existing chats and model files. Download a model while online, then test a cold launch in airplane mode. New model downloads still require internet. A voice model is needed only for voice typing; chat uses its separately selected chat model.

Standalone updates currently require a new APK installed over the existing app; there is no automatic or over-the-air update service. Native-library changes always require a new compatible binary. Closing the app unloads models from RAM while downloaded model files remain. Chat offers **Load last model** after a successful load has been saved by this version; it never downloads or loads a model automatically.

Rebuild from source with the Android/JDK/Node environment configured below:

```bash
npm run build:android:standalone
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. Current personal-use builds retain the same development signing key as previous APKs; a future store release needs a dedicated production signing setup. Keep the existing key for updates. Do not regenerate it for an existing installation.

## Run on a phone (development)

For Wi-Fi Fast Refresh, install **PhoneGPT Dev**, `PhoneGPT-v0.4.4-development.apk` (Android code 13), as a separate app. Its package is `com.phonegpt.app.dev` and display name is `PhoneGPT Dev`; the normal app remains `PhoneGPT` / `com.phonegpt.app`. Chats, settings and downloads are separate, so download/select models in Dev independently. Do not uninstall the normal app. The dev deep-link scheme is `exp+phone-gpt-dev` to avoid opening the production app. Open `http://192.168.29.111:8083` in the development launcher while this computer and phone share Wi-Fi. The address is session-specific; use Metro's current address if it changes. The chat composer shows the selected voice model and live interval. Chats started in Dev persist an `origin: dev` marker and display `Dev -` before the normal first-message history preview. JavaScript/UI/interval edits arrive from Metro without installing another APK; native modules, permissions and native dependency changes still require a rebuild. This development app needs the server to load code; keep the separate v0.4.3 standalone APK if offline cold-start is needed.


Local tool paths used on this Ubuntu x64 workstation:

```bash
cd /home/parth/Desktop/Python/phone-gpt
export JAVA_HOME="/home/parth/Desktop/Python/.phonegpt-tools/jdk-17.0.20.1+1"
export ANDROID_HOME="/home/parth/Desktop/Python/.phonegpt-tools/android-sdk"
export PATH="/home/parth/.local/node/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Install dependencies with `npm ci` when setting up a fresh checkout. Signing keys are excluded from Git. For a fresh checkout, generate a local development key once before building (JDK `keytool` must be on your PATH):

```bash
keytool -genkeypair -v -storetype JKS -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -keysize 2048 -validity 10000
```

Keep your existing local key when updating an installed app; a newly generated key cannot sign an in-place update of an APK signed with a different key. The current release Gradle configuration also uses this development key; production signing still needs configuration. Native Hexagon assets are copied from `llama.rn` by its Gradle task and are excluded from Git along with build outputs, installed dependencies, local Expo state, model weights and APKs.

Start one Metro server, then open its generated URL/QR with the PhoneGPT development client on the same network:

```bash
npm run start:dev
```

Use the current terminal's LAN address, not an old `19006` or `8081` URL from a previous session. A phone browser opening `http://<computer-LAN-IP>:8083/status` should report `packager-status:running`.

USB is an alternative to LAN for development. Enable USB debugging, authorize the computer, then:

```bash
adb devices
adb reverse tcp:8083 tcp:8083
```

Open `http://127.0.0.1:8083` in the PhoneGPT Dev development launcher when using USB forwarding. USB and Metro are not required for running a standalone APK.

To build the Android development APK with the environment above:

```bash
npm run build:android:dev
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`adb install -r` updates PhoneGPT Dev while retaining its own data when package/signing are compatible. It does not replace or share data with normal PhoneGPT. `app.config.js` selects matching Expo metadata when `APP_VARIANT=development`; Android debug-specific app ID, label and deep-link placeholders are configured in Gradle/debug resources. Release retains the production identity. Browser UI checks can use `npx expo start --web`; browser checks do not validate native inference, file pickers or Android background downloads.

## Local storage and attachments

AsyncStorage stores JSON under these keys:

- `@phone-gpt/chats` — conversation UUID, messages, creation/update timestamps and per-chat system-prompt snapshot.
- `@phone-gpt/inference-settings` — generation/context settings.
- `@phone-gpt/theme` — appearance preference.
- `@phone-gpt/font-scale` — global text-size multiplier.
- `@phone-gpt/last-loaded-model` — last successfully loaded chat model ID.
- `@phone-gpt/voice-model` — selected voice model ID.
- `@phone-gpt/system-prompt` — prompt saved in Settings for new chats.

Each chat record contains `id`, `title`, `messages`, optional `createdAt`/`updatedAt`, and optional `systemPrompt`. Messages contain an ID, role, content and optional attachment references. History derives its preview from the first user message and its displayed time from `createdAt`, not the last reply. Conversations are serialized JSON records in AsyncStorage, rather than separate editable source JSON files.

The paperclip accepts plain UTF-8 `.txt` files up to **32 KB**, subject to available model context. It supports a file alone or a file plus a question, without inserting an extra user question. Original file bytes are copied to app-private `documentDirectory/chats/<chat-id>/attachments/`; conversation JSON stores only the filename, URI and size. Files are read when preparing inference input and wrapped in minimal file-name/end markers. Legacy inline attachments migrate to files. Invalid extensions, empty/non-text input and over-budget attachments are rejected before sending. Removing a pending attachment does not delete the user's original document.

New Android models use app-specific external storage: `Android/data/com.phonegpt.app/files/Download/models/`. PhoneGPT Dev uses `Android/data/com.phonegpt.app.dev/files/Download/models/` instead; neither app reads the other app’s private data. Earlier private `documentDirectory/models/` downloads remain supported. New transfer metadata persists in `phone_gpt_transfers_v2`; partial files use a `.part` suffix until completion. Manual pause is persisted; HTTP Range with ETag/Last-Modified validates resuming and restarts safely when necessary. Legacy DownloadManager IDs/metadata remain in `phone_gpt_downloads_v1`; those existing tasks finish normally but have no manual-pause API. Progress is recovered when reopening the app. The implementation supports background/process restart, but the physical-device lifecycle check remains To-do. Android force-stop, battery restrictions and connectivity can pause work. The X button explicitly cancels a download.

An in-place app update preserves app data; **uninstalling or clearing app data removes saved chats, preferences, private attachments and app-specific models**. iOS currently uses the existing file-system downloader, not the Android persistent service.

## Source map and handoff notes

- `App.tsx` — screens/navigation, chat state, message sending, inference controls and orchestration.
- `src/data/models.json` — local provider/model catalog and direct GGUF download links.
- `src/services/localInference.ts` — native model lifecycle, system prompt, conversation input, token accounting and streamed responses.
- `src/services/models.ts` — model files and native-download/fallback integration.
- `src/services/textAttachments.ts` — private TXT storage, migration and model-input file reading.
- `src/services/documentPicker.ts` — guarded optional native picker availability and deferred loading.
- `src/services/chatIds.ts`, `src/services/chatHistory.ts` — UUIDs, history previews and start timestamps.
- `src/theme/AppTheme.tsx` — shared light/dark palette and persistence.
- `src/hooks/useSystemPromptSettings.ts`, `src/components/SystemPromptSettings.tsx` — saved custom prompt and Settings form.
- `src/components/NavigationDrawer.tsx` — horizontal drawer animation and fading backdrop, retaining the modal until close finishes.
- `src/components/ChatModelSelector.tsx` — downloaded-only chat dropdown, file checks and selection.
- `src/theme/FontScale.tsx` and `src/components/ScaledText.tsx` — persisted global text size and native text/input wrappers; nested inline text inherits correctly.
- `src/config/voice.ts` — live/recording mode flag and one-second live interval.
- `src/services/liveTranscription.ts` — sequential overlapping-window inference and final audio drain.
- `src/services/liveDraft.ts` — provisional dictation replacement and manual-edit preservation.
- `src/hooks/useLastLoadedModel.ts` — successful chat-model load persistence and reload card state.
- `src/components/AppInfo.tsx` — version, privacy/storage, supported input and founder information.
- `src/components/WelcomeHome.tsx`, `ProviderGroup.tsx`, `MessageContent.tsx`, `PaperclipIcon.tsx` — homepage, model groups, message formatting and attachment icon.
- `android/app/src/main/java/com/phonegpt/app/PhoneGptDownloadsModule.kt` and `PhoneGptDownloadsPackage.kt` — download bridge with legacy DownloadManager support; `PhoneGptTransferService.kt` owns new resumable transfers, and `ResumableModelTransfer.java` streams and validates HTTP ranges. `MainApplication.kt` registers the bridge.
- `app.json`, `android/app/build.gradle`, `App.tsx`, `package.json` and root package metadata in `package-lock.json` — version locations to keep consistent when releasing.

Preserve the custom Android bridge and its registration when changing native configuration. Avoid blindly regenerating the Android directory or clearing native/CMake caches: a full llama.cpp rebuild can be lengthy. Android uses Hermes and the React Native new architecture. iOS delivery, image inference and voice features remain backlog work.

Useful checks, chosen according to the change:

```bash
npx tsc --noEmit
npx expo install --check
npx expo export --platform android --output-dir /tmp/phonegpt-android-export
```

These checks do not replace the physical-phone tasks in the tracker. Standalone artifact checks do not replace a physical cold-launch, local-chat and voice test in airplane mode. Complete cross-model/iOS validation is not claimed.

Native download fixture tests: compile `ResumableModelTransfer.java` and `tests/native/ResumableModelTransferTest.java` with the local JDK into a temporary directory, then run `com.phonegpt.app.ResumableModelTransferTest` with `--add-modules jdk.httpserver`. Tests use a local HTTP server, not Hugging Face/model payloads. Android service lifecycle and network transitions still need A54 testing. Background data-sync limits/battery restrictions may stop work; timeout handling preserves checkpoints and exposes retry.
