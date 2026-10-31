# PhoneGPT project tracker

Last reviewed: 2026-10-31. Current source version: **0.5.0**, Android version code **14**. Dev and standalone production are synchronized from the same source; physical-device checks remain pending.
Scope: private, on-device model downloads and chat in one mobile repository, with no chat backend. “Done” means implemented; outstanding physical-device checks are explicitly listed under To-do. Setup, dependencies, storage and source locations are in [README.md](README.md).

## To-do

- [ ] **A54 recovery verification:** follow [six-step device checklist](docs/A54_TEST_CHECKLIST.md), especially paused/resumed downloads, reopening without duplicate tasks, X cancellation and retry/load labels. Manual Pause/Resume requires the new Dev APK; the Chat + button arrives through Metro. Production sync is authorized for 0.5.0.

- [ ] **Launch UI polish (current priority):** verify the new minimal teal home/theme/icons/navigation on A54; refine Chat, Models, voice controls, Settings and App Info, including accessibility, font sizes and keyboard behavior. See [release plan](docs/PLAY_STORE_RELEASE_PLAN.md).
- [ ] **Smooth offline/download experience:** connectivity feedback for network operations, retry/recovery, download clarity and device performance checks; local chat stays offline-capable.
- [ ] **Small release candidate (after the 0.5.0 sync):** AAB, measured Play download size, R8/resource shrinking, unused image-picker removal and engine-variant audit. Preserve inference compatibility; no size-saving release changes applied now. See [size plan](docs/APP_SIZE_PLAN.md).
- [ ] **Privacy/release gaps:** decide Android OS backup behavior (`allowBackup` currently true), host privacy policy, define user-controlled AI-report delivery/support destination and verify model licensing before submission.
- [ ] **Play Store preparation:** production AAB/upload signing, native 16 KB checks, target API, privacy policy/Data safety, AI-content reporting/policy review, listing assets and applicable closed testing. No login for the first release.

- [ ] **Live transcription on A54:** test Tiny/Base, one-second updates, revised words, silence/noise, long recordings, editing the draft, Stop, Cancel, chat switches, offline use and CPU/memory/latency. Compare with preserved recording mode.

- [ ] **New settings/device checks:** verify text presets across chat, keyboard, drawer and dark mode; cold-reopen and reload last model; check live microphone bars when speaking and silence.

- [ ] **Standalone device verification:** install the release APK over the current app, confirm chats/downloaded models survive, cold-launch in airplane mode, run chat and voice transcription with already downloaded models, and verify there is no Metro/QR prompt.

- [ ] **Voice device verification:** install the new standalone APK on Samsung A54; download/select each voice model, grant/deny microphone permission, record/stop/repeat, append into an existing draft, edit during transcription, cancel, switch chats, background the app and check audio cleanup. Confirm local transcription with network disabled after models and application code are available.

## Done

- [x] **0.5.0 Dev/production sync and branding:** supplied logo in both launchers, splash and application screens; final Dev built and browser-checked before standalone production. Both APKs use version code 14 and matching update certificates. Nine test files, TypeScript, six native download fixture scenarios, packaged feature/icon checks, ZIP integrity and 16 KB ZIP/ELF alignment pass. Standalone is 63,003,884 bytes; Dev is 102,412,459 bytes, with no model weights bundled. Device testing remains above.
- [x] **Chat deletion:** separate trash actions in history and search, confirmation/cancel, serialized local history persistence, private attachment cleanup, active-chat reset and busy guards. Focused tests pass; A54 confirmation and data-retention checks remain pending.
- [x] **History search placement / empty-chat reuse:** Search now sits beside Chat History in the drawer; drawer exit completes before search opens. Plus and New chat preserve an existing empty conversation, UUID, draft and attachment; a conversation with messages starts a fresh one. Helper tests and Dev browser verification pass.

- [x] **Local chat-history search:** Chat History search icon opens an animated full-screen searchable list, literal case-insensitive substring matching in titles/messages, highlighted excerpts, newest-started ordering, clear/close actions and keyboard/safe-area handling. Agent implementation reviewed/integrated; focused tests and web empty/query states verified. A54 interaction testing pending.

- [x] **Stop generation:** Send becomes a Stop control during local generation, keeps partial text/history and the next draft, handles stopping before native start/first token, and drains cancellation before another turn. Focused cancellation tests pass; A54 check pending.

- [x] **Draft while generating / send scrolling:** text input stays editable during a reply; Send remains blocked. Sending explicitly scrolls to the newest message after rendering, and edits made during asynchronous request preparation are preserved. Manual scrolling still stops stream auto-follow. A54 verification pending.

- [x] **Manual Pause/Resume (both builds):** new native foreground resumable downloader, persisted manual pause/checkpoints, validated HTTP ranges and safe restart fallback; existing DownloadManager tasks remain supported. Per-model No internet status replaces the global notice; Pause/Resume/X controls support chat and voice downloads. Native build, TypeScript, JS regressions and local HTTP fixture checks pass; A54 lifecycle verification remains To-do.
- [x] **New chat shortcut:** top-right + in Chat, hover/focus/hold label, accessible button, existing conversation history preserved; fresh UUID only after a conversation has messages; empty draft reuse confirmed in web preview.

- [x] **Simple download recovery hardening:** surface paused state during active chat/voice transfers, reattach existing tasks without duplicate free-space checks, avoid stale legacy files for incomplete native downloads, remove failed legacy transfers, offer Retry loading for an existing file, and show cancel/delete errors. Eight focused recovery scenarios plus existing regression suite/type checks pass; A54 behavior remains pending.

- [x] **Dev screen polish:** Settings/App Info cards, consistent model/voice action buttons, progress bars, SVG controls, larger touch targets and empty history guidance; regression tests, TypeScript and Dev native build pass. Included in the 0.5.0 standalone sync. Phone/network testing remains To-do.
- [x] **Local download connectivity feedback:** Validated Android network state, no external probes, no blocking offline inference. Latest UI shows No internet only alongside affected transfers; manually paused transfers are distinct. Old native clients fall back to generic download guidance; new Dev APK required for status detection.
- [x] **App size baseline:** frozen standalone measured at 60.76 MB with no model weights bundled; native libraries contribute 45.23 MB. Repeatable APK audit added; 23/23 native ELF alignment checks and 16 KB ZIP alignment pass. See [size plan](docs/APP_SIZE_PLAN.md). Runtime/Play download-size checks remain pending.

- [x] **Initial teal visual refresh (source):** redesigned Home, shared light/dark palette, outline SVG icons, drawer active states, model accents and composer surface. Web home/navigation/Settings/model groups visually checked; TypeScript and regression tests pass. Physical-phone review remains To-do.

- [x] **Separate PhoneGPT Dev APK:** debug name/package/deep link isolated from production, verified APK built (about 101 MB), production artifact unchanged, native modules and Wi-Fi manifest/bundle checked.
- [x] **Dev chat labels:** new Dev conversations persist their origin and show `Dev -` before the history preview; normal chats retain their labels.

- [x] **Wi-Fi development updates:** v0.4.4 uses a one-second live interval and shows the selected Whisper model above the composer; Metro serves updates over LAN. Install PhoneGPT Dev once alongside the standalone app; future JavaScript edits can use Fast Refresh. Dev uses its own ID/name/link scheme and independent chats/models.
- [x] **User feedback:** Parth reports v0.4.3 live transcription working well; broader device/accuracy/lifecycle checks remain To-do.

- [x] **v0.4.3 verification:** all 40 regression tests, TypeScript and Android release build pass; embedded app version/live UI, native snapshot method and v0.4.2-compatible signing certificate verified. Phone audio/latency checks remain To-do.

- [x] **Experimental live transcription:** enabled by `src/config/voice.ts` flag, one-second attempted updates, continuous mic capture, bounded overlapping audio windows, one reused Whisper context, sequential inference, final flush, protected manual draft edits and cancellation cleanup. Original recording flow remains available via `'recording'`.

- [x] **v0.4.2 verification:** 24 regression tests, TypeScript and Android release build pass; APK integrity, bundled feature markers, native modules, version and matching upgrade certificate checked. Physical-device checks remain To-do.
- [x] **Text sizing:** persistent global font-size presets (0.5×, 0.8×, 1×, 1.2×, 1.5×), applied to screens, formatted chat and inputs.
- [x] **Last chat model:** save successful loads and offer a load-last-model button after reopening; deleting that model clears the saved choice.
- [x] **Voice typing:** four downloadable Whisper English models, native private WAV recording without the former 120-second cutoff, local transcription appended to the editable draft, cancel/cleanup and chat-switch protection. Live microphone bars use real audio energy and clear during silence.

- [x] **Mobile foundation:** React Native, TypeScript and Expo setup in the single `phone-gpt` repository; local `models.json` catalog, with the earlier backend proposal removed.
- [x] **Android native tooling:** local JDK/Android SDK setup, native Android project, custom development client and APK build workflow for native inference. Latest generated artifact is `PhoneGPT-v0.5.0-standalone.apk` (about 63 MB); native Android release build passed. The earlier voice APK is a Metro-dependent development build.
- [x] **Branding and navigation:** PhoneGPT app name/icon, welcome homepage, drawer navigation that slides in from the left with a fading backdrop, Models, Settings and App Info screens.
- [x] **Responsive chat layout:** safe-area and keyboard handling, scrolling conversation, input/send controls, automatic scrolling and post-response focus handling. Device regression remains To-do.
- [x] **Local model inference:** GGUF loading/unloading and streaming responses through `llama.rn` / llama.cpp on the phone; current conversation messages passed on each turn.
- [x] **Generation feedback:** inline “Generating locally…” status; prevent concurrent sends while allowing the next draft during generation; display model reasoning without filtering and normalize loading percentages. Stream output into the active response bubble; persist completed replies and retain partial output on errors.
- [x] **Chat model dropdown:** list only downloaded models in the chat header, recheck files before loading, preserve the conversation when switching and block switching during generation/loading.
- [x] **Model catalog and selection:** Qwen, Llama, SmolLM2, DeepSeek and Gemma entries, collapsed-by-default family dropdowns with nonempty Censored/Uncensored subgroups and expandable model configuration, selected loaded-model header and model-family capability labels. 13 variants include Null-Guard Qwen3 0.6B Uncensored (Q4/Q5), Huihui Qwen3 1.7B Abliterated v2 (Q4/Q5), Llama 3.2 1B Instruct Uncensored (i1-Q4/i1-Q5), Llama 3.2 3B Instruct Abliterated (Q4), and DeepSeek R1 Distill Qwen 1.5B Uncensored (Q5/Q8). New download URLs, exact sizes and nonzero repository download activity checked on 2026-10-25; device inference validation remains to-do.
- [x] **Model management:** download progress, free-space checks, load/delete/error controls and explicit X cancellation; browsing other models does not cancel an active download.
- [x] **Persistent Android downloads:** native DownloadManager bridge, persisted download tracking and progress restoration after process restart. Physical-device lifecycle verification remains To-do; iOS needs a separate strategy.
- [x] **Inference controls:** shared controls in Settings and Models for reasoning off/short/extended, output budgets of 192/384/512/768 tokens and context windows of 1024/2048/4096 tokens; locked during generation/model loading. These are app settings, not each model's maximum supported context.
- [x] **Context tracker:** conversation-based usage display, excluding hidden system instructions from the visible count; request budgeting includes the prompt where checked.
- [x] **Local conversation persistence:** JSON chat records in AsyncStorage, stable UUIDs and legacy ID migration; UUID in the chat header, first-message preview and conversation-start date/time in history.
- [x] **Message presentation:** bounded long-message layout, selectable/copyable text and formatting for headings, bold, inline code, numbered lists and bullet lists; smaller message fonts.
- [x] **TXT attachments:** SVG paperclip, UTF-8 `.txt` selection up to 32 KB, validation and context checks; support sending a file with a question or by itself without inserting an automatic user question.
- [x] **Attachment storage and inference:** preserve original file bytes in private chat folders, store references in JSON, read contents into marked file blocks for inference, and migrate older inline attachments.
- [x] **Native picker fixes:** align Expo picker packages with SDK 57, rebuild native modules, and guard unavailable document-picker modules. Latest native artifact includes the document picker.
- [x] **Dark mode:** persistent Settings toggle and shared light/dark styling across app screens, messages, controls and status bar.
- [x] **System Prompt settings:** editable field and Save action, local persistence, per-new-chat prompt snapshot and hidden system-role message before conversation input; blank uses the existing default prompt.
- [x] **Android Back behavior:** close an open drawer to Chat; secondary screens return to Chat, Chat returns Home, and Home permits system exit.
- [x] **App information:** founder/developer biography for Parth Verma using the supplied Coinbase machine-learning-engineer background; app version, local processing/privacy, offline development-build requirements, TXT support and data-removal details.
- [x] **Project handoff documentation:** version/build distinction, installed library versions, development commands, architecture and storage notes recorded in README.



## Backlog

- [ ] **Optional email/password accounts (after initial release):** optional home-page sign-in to identify voluntarily registered customers, separate FastAPI service and MongoDB Dev/Prod databases with matching `users` schema validators/indexes. Basic identity only; no chats/preferences uploaded. No resources provisioned now. Google sign-in deferred further. See [authentication plan](docs/AUTHENTICATION_PLAN.md).

- [ ] **Shared Dev/production storage:** signature-protected storage bridge for chats, attachments and model files; requires production and Dev native updates. User chose separate storage now and shared storage later; current builds retain independent storage.

- [ ] **Image chat:** download and load matching vision projectors (`mmproj`) for compatible models, run image-plus-text inference locally and render images in messages/history. Family capability labels alone do not enable this.
- [ ] **Image storage:** copy originals to private per-chat folders, persist references and clean up stored images when their chat is deleted.
- [ ] **Additional document formats:** local PDF/DOCX and other format parsing, useful errors and chunking/context budgeting for larger documents; decide OCR support for scanned pages.
- [ ] **Additional voice capabilities:** spoken responses/text-to-speech, more speech models and optional language selection.
- [ ] **iOS voice typing:** native microphone recorder, permissions, runtime/memory testing and device validation.
- [ ] **iOS delivery:** native build, permissions, inference and document-picker testing, plus an iOS background-download strategy.
