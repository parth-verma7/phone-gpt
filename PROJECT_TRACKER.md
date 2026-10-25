# PhoneGPT project tracker

Last reviewed: 2026-10-25. Current app version: **0.3.9**, Android version code **8**.  
Scope: private, on-device model downloads and chat in one mobile repository, with no chat backend. “Done” means implemented; outstanding physical-device checks are explicitly listed under To-do. Setup, dependencies, storage and source locations are in [README.md](README.md).

## Done

- [x] **Mobile foundation:** React Native, TypeScript and Expo setup in the single `phone-gpt` repository; local `models.json` catalog, with the earlier backend proposal removed.
- [x] **Android native tooling:** local JDK/Android SDK setup, native Android project, custom development client and APK build workflow for native inference. Latest generated artifact is `PhoneGPT-v0.3.9-chat-uuid.apk`.
- [x] **Branding and navigation:** PhoneGPT app name/icon, welcome homepage, drawer navigation that slides in from the left with a fading backdrop, Models, Settings and App Info screens.
- [x] **Responsive chat layout:** safe-area and keyboard handling, scrolling conversation, input/send controls, automatic scrolling and post-response focus handling. Device regression remains To-do.
- [x] **Local model inference:** GGUF loading/unloading and streaming responses through `llama.rn` / llama.cpp on the phone; current conversation messages passed on each turn.
- [x] **Generation feedback:** inline “Generating locally…” status; prevent concurrent sends and disable editing during generation; display model reasoning without filtering and normalize loading percentages. Stream output into the active response bubble; persist completed replies and retain partial output on errors.
- [x] **Chat model dropdown:** list only downloaded models in the chat header, recheck files before loading, preserve the conversation when switching and block switching during generation/loading.
- [x] **Model catalog and selection:** Qwen, Llama, SmolLM2, DeepSeek and Gemma entries, expandable provider/model configuration, selected loaded-model header and model-family capability labels. DeepSeek includes the R1 Distill Qwen 1.5B Uncensored Q5_K_M and Q8_0 GGUF variants; device inference validation remains to-do.
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

- [ ] **Image chat:** download and load matching vision projectors (`mmproj`) for compatible models, run image-plus-text inference locally and render images in messages/history. Family capability labels alone do not enable this.
- [ ] **Image storage:** copy originals to private per-chat folders, persist references and clean up stored images when their chat is deleted.
- [ ] **Additional document formats:** local PDF/DOCX and other format parsing, useful errors and chunking/context budgeting for larger documents; decide OCR support for scanned pages.
- [ ] **Voice models:** model catalog/download/loading support for local audio models; define speech input/output scope and device requirements.
- [ ] **Voice typing:** microphone permissions, recording, on-device speech-to-text and editable transcription before sending.
- [ ] **iOS delivery:** native build, permissions, inference and document-picker testing, plus an iOS background-download strategy.
