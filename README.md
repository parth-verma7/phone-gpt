# PhoneGPT

PhoneGPT downloads models and runs chat inference on the phone, keeping conversations locally. It is a React Native app targeting Android and iOS; the current native build and primary test target are Android / Samsung A54. There is no FastAPI service or chat backend. The model catalog lives in this repository.

Start with [PROJECT_TRACKER.md](PROJECT_TRACKER.md) for **To-do**, **Done** and **Backlog**. Last reviewed: **2026-10-25**.

## Version and build status

- Current source/UI/app version: **0.3.9**. Android version code: **8**. Android application ID: `com.phonegpt.app`.
- Latest generated native artifact: `PhoneGPT-v0.3.9-chat-uuid.apk`, an **arm64 Android debug development build**. The version installed on a particular phone must be checked on that device; it has not been independently verified here.
- SDK: **Expo 57**, installed Expo package **57.0.30**, React Native **0.86.3**, React **19.2.3**. Older SDK 54 instructions and APKs are historical.
- Source updates after that APK was generated include file-backed TXT attachments, history previews/start timestamps, App Info updates, dark mode, Back handling and System Prompt settings. The development client receives these changes from Metro; the APK filename/version alone does not identify its currently served JavaScript revision.
- This development APK needs **Metro** to serve application code. A standalone release with the latest JavaScript embedded remains To-do. Local inference itself runs on-device; after a standalone build and model download, chat should work without Wi-Fi, subject to verification.
- **Expo Go cannot run this app's native inference/download bridge.** Use the PhoneGPT development client. Native dependency or Kotlin changes require a rebuilt and reinstalled APK; JavaScript-only changes normally need a Metro reload.

## Implemented behavior

- Welcome homepage; navigation drawer slides in from the left and slides back out when dismissed; navigation to fresh Chat, Models, Settings and App Info; scrollable saved chat history.
- Streamed local responses through `llama.rn`, with conversation history supplied on every turn. Generation uses inline feedback and prevents overlapping sends.
- UUID in the chat header and a downloaded-model dropdown below it; selecting an installed model loads it without clearing the current conversation. Switching is blocked during generation/loading. History shows the first-message preview and the conversation's start date/time.
- Model download/load/delete controls, free-space checks, provider/model accordions and cancel buttons. Android downloads use the system DownloadManager independently of the selected UI card.
- Selectable messages with headings, bold, inline code and list formatting; bounded long-message layout, keyboard/safe-area handling and automatic scrolling/focus.
- Live local token streaming into one reply bubble, including reasoning emitted by the model (no reasoning filter). Stream updates stay in UI state; completed replies and partial replies on errors are saved to chat history. Reasoning controls request model behavior and support varies by model.
- Shared generation preferences in Settings and Models, disabled while generating or loading/checking a model. Reasoning choices off/short/extended; output budgets **192, 384, 512, 768** tokens; app context settings **1024, 2048, 4096** tokens. These limits describe the app's controls, not model-family maximums. Reasoning behavior depends on model/template support.
- The visible context tracker counts the current conversation, including file content, and excludes hidden system instructions. It is not a complete measure of model memory or prompt-template overhead.
- Persistent light/dark theme and a saved System Prompt field. A new chat snapshots the saved prompt at its first send; later turns reuse it as a hidden system-role message before the conversation. Existing chats retain their prompt. Blank uses the default assistant prompt, currently named **Parth**.
- App Info includes the app version, local processing/storage details, TXT support, development-build offline requirements and founder biography.
- Android Back: open drawer → Chat; secondary screen → Chat; Chat → Home; Home → system exit.

The catalog currently lists Qwen 3.5 0.8B, Llama 3.2 1B Instruct, SmolLM2 1.7B Instruct, DeepSeek R1 Distill Qwen 1.5B Uncensored (Q5_K_M, approximately 1.29 GB; Q8_0, approximately 1.89 GB) and Gemma 4 E2B Instruct as GGUF downloads. DeepSeek has its own category; both variants use community GGUF conversions by mradermacher of thirdeyeai's fine-tune. Links, device memory requirements and compatibility still need a complete phone validation pass. Image capability labels describe the model family; **current attachment/inference support is text and TXT only**.

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

## Run on a phone

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
npx expo start --dev-client --lan --port 8083 --clear
```

Use the current terminal's LAN address, not an old `19006` or `8081` URL from a previous session. A phone browser opening `http://<computer-LAN-IP>:8083/status` should report `packager-status:running`.

USB is an alternative to LAN for development. Enable USB debugging, authorize the computer, then:

```bash
adb devices
adb reverse tcp:8083 tcp:8083
```

Open `http://127.0.0.1:8083` in the development launcher when using USB forwarding. USB is not a requirement for running a future standalone APK.

To build the Android development APK with the environment above:

```bash
./android/gradlew -p android :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`adb install -r` updates the app while retaining its data when package/signing are compatible. Browser UI checks can use `npx expo start --web`; browser checks do not validate native inference, file pickers or Android background downloads.

## Local storage and attachments

AsyncStorage stores JSON under these keys:

- `@phone-gpt/chats` — conversation UUID, messages, creation/update timestamps and per-chat system-prompt snapshot.
- `@phone-gpt/inference-settings` — generation/context settings.
- `@phone-gpt/theme` — appearance preference.
- `@phone-gpt/system-prompt` — prompt saved in Settings for new chats.

Each chat record contains `id`, `title`, `messages`, optional `createdAt`/`updatedAt`, and optional `systemPrompt`. Messages contain an ID, role, content and optional attachment references. History derives its preview from the first user message and its displayed time from `createdAt`, not the last reply. Conversations are serialized JSON records in AsyncStorage, rather than separate editable source JSON files.

The paperclip accepts plain UTF-8 `.txt` files up to **32 KB**, subject to available model context. It supports a file alone or a file plus a question, without inserting an extra user question. Original file bytes are copied to app-private `documentDirectory/chats/<chat-id>/attachments/`; conversation JSON stores only the filename, URI and size. Files are read when preparing inference input and wrapped in minimal file-name/end markers. Legacy inline attachments migrate to files. Invalid extensions, empty/non-text input and over-budget attachments are rejected before sending. Removing a pending attachment does not delete the user's original document.

New Android models use app-specific external storage: `Android/data/com.phonegpt.app/files/Download/models/`. Earlier private `documentDirectory/models/` downloads remain supported. DownloadManager IDs/metadata persist in native SharedPreferences `phone_gpt_downloads_v1`; progress is recovered when reopening the app. The implementation supports background/process restart, but the physical-device lifecycle check remains To-do. Android force-stop, battery restrictions and connectivity can pause work. The X button explicitly cancels a download.

An in-place app update preserves app data; **uninstalling or clearing app data removes saved chats, preferences, private attachments and app-specific models**. iOS currently uses the existing file-system downloader, not the Android persistent service.

## Source map and handoff notes

- `App.tsx` — screens/navigation, chat state, message sending, inference controls and orchestration.
- `src/data/models.json` — local provider/model catalog and direct GGUF download links.
- `src/services/localInference.ts` — native model lifecycle, system prompt, conversation input, token accounting and full responses.
- `src/services/models.ts` — model files and native-download/fallback integration.
- `src/services/textAttachments.ts` — private TXT storage, migration and model-input file reading.
- `src/services/documentPicker.ts` — guarded optional native picker availability and deferred loading.
- `src/services/chatIds.ts`, `src/services/chatHistory.ts` — UUIDs, history previews and start timestamps.
- `src/theme/AppTheme.tsx` — shared light/dark palette and persistence.
- `src/hooks/useSystemPromptSettings.ts`, `src/components/SystemPromptSettings.tsx` — saved custom prompt and Settings form.
- `src/components/NavigationDrawer.tsx` — horizontal drawer animation and fading backdrop, retaining the modal until close finishes.
- `src/components/ChatModelSelector.tsx` — downloaded-only chat dropdown, file checks and selection.
- `src/components/AppInfo.tsx` — version, privacy/storage, supported input and founder information.
- `src/components/WelcomeHome.tsx`, `ProviderGroup.tsx`, `MessageContent.tsx`, `PaperclipIcon.tsx` — homepage, model groups, message formatting and attachment icon.
- `android/app/src/main/java/com/phonegpt/app/PhoneGptDownloadsModule.kt` and `PhoneGptDownloadsPackage.kt` — custom Android DownloadManager bridge; `MainApplication.kt` registers it.
- `app.json`, `android/app/build.gradle`, `App.tsx`, `package.json` and root package metadata in `package-lock.json` — version locations to keep consistent when releasing.

Preserve the custom Android bridge and its registration when changing native configuration. Avoid blindly regenerating the Android directory or clearing native/CMake caches: a full llama.cpp rebuild can be lengthy. Android uses Hermes and the React Native new architecture. iOS delivery, image inference and voice features remain backlog work.

Useful checks, chosen according to the change:

```bash
npx tsc --noEmit
npx expo install --check
npx expo export --platform android --output-dir /tmp/phonegpt-android-export
```

These checks do not replace the physical-phone tasks in the tracker. No standalone release APK or complete cross-model/iOS validation is claimed by the current project state.
