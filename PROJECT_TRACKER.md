# PhoneGPT project tracker

Last reviewed: 2026-11-06. Current source/Android build version: **0.5.4**, version code **18**. iOS source/build configuration 0.5.4 / 18 has not been compiled or signed. Dev/standalone were rebuilt from the current shared source, including flexible token controls and live transcription. Physical-device checks remain pending.
Scope: private, on-device model downloads and chat in one mobile repository, with no chat backend. “Done” means implemented; outstanding physical-device checks are explicitly listed under To-do. Setup, dependencies, storage and source locations are in [README.md](README.md).

## To-do

- [ ] **Model RAM/device compatibility:** research exact quantizations, separate download storage from runtime RAM, account for context/cache and simultaneous voice-model memory, measure standalone peaks on A54, and show source-labelled estimates/device guidance. Start with Qwen 3.5 0.8B plus Whisper Tiny/Base. All catalog entries need coverage; no RAM minimum is verified yet. See [research and acceptance criteria](docs/MODEL_MEMORY_RESEARCH.md).

- [ ] **A54 0.5.4 parity:** install the matching rebuilt APK, confirm App Info shows 0.5.4, and check both token sliders in Settings → Generation and expanded model options. See [verification](docs/RELEASE_0.5.4.md).

- [ ] **Android / Play Store launch:** complete the [2026-11-03 readiness audit](docs/PLAY_STORE_READINESS.md). Not submission-ready: AI safeguards and in-app reporting, public privacy policy/backup decision, release permissions, upload signing/AAB, account/listing declarations, licensing and physical/required closed testing remain open. The About contact form is not an AI-reporting flow.
- [ ] **iOS / App Store launch:** after native compilation/signing and iPhone verification, distribute through TestFlight and complete Apple privacy/listing/review requirements. No signed build or store submission yet.
- [ ] **About/contact and Preferred badge on A54:** verify keyboard, validation, email-app handoff/fallback, light/dark and font sizes. Sending an actual support email remains the user's choice. Verify Qwen → Censored → Qwen 3.5 0.8B shows Preferred independently of loaded state.

- [ ] **iOS compilation and installation:** source/native modules, project and EAS profiles are prepared; obtain Expo/Apple developer signing setup, run a macOS/cloud CocoaPods/Xcode build, fix compile/runtime findings and complete the [iPhone checklist](docs/IOS_BUILD_AND_TEST.md). The owner has an iPhone only; no signed IPA or TestFlight build was produced. Do not mark iOS feature parity complete from JS export/source checks alone.

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

- [x] **Website navigation/layout refinement:** homepage section navigation plus explicit Home shortcuts, inline expandable model catalog/full FAQ/downloads, compact model/detail-page spacing and corrected centered callout. Phone sample preview simplified at owner request. Static fragment checks and desktop/mobile review accompany the website update; mobile app behavior is unchanged.

- [x] **Public website implementation:** separate Next.js static website with ten product/setup/model/privacy/contact/release pages, model filters, founder feedback/model-request email handoff, mobile/desktop styling and SEO metadata. Parallel design/content/SEO reviews and production-output checks; GitHub Pages publication status is recorded in the website README. No mobile binary or store-readiness change.

- [x] **About/contact and model recommendation (0.5.3 builds):** removed employer/detailed biography; retained relevant app info and short creator attribution. Added validated name/email/message email-app handoff with preserved draft/fallback, no backend or automatic sending. Added editorial Preferred badge to Qwen 3.5 0.8B. See [release checks](docs/RELEASE_0.5.3.md).
- [x] **Store readiness review:** inspected target API, merged permissions, signing and packaged native alignment; documented concrete submission gaps and explicit iOS/Android launch tasks. This is not store approval.

- [x] **iOS source port / Android 0.5.2 parity:** generated iOS project and Apple-only Expo recorder/background-URLSession modules; wired existing live transcription/download contracts, permissions and separate Dev/Release identities, with EAS build profiles. Shared tests, TypeScript, autolinking, source-wiring checks and iOS production JS export pass. Rebuilt Android Dev then standalone and verified current sources/signing/native packaging. iOS Swift/native compilation, signing and device behavior remain unverified; see [release/handoff](docs/RELEASE_0.5.2.md).

- [x] **Backup multi-agent implementation planning:** three independent UX/data/Android reviews completed, with shared-contract, parallel write-scope, independent review and Dev/standalone gates in the [execution plan](docs/GOOGLE_DRIVE_IMPLEMENTATION_PLAN.md). Incorporated Home discovery, durable queue before manual uploads, branch identity/lineage and worker-claim corrections. Documentation only; Drive implementation/provider clearance remain backlog.

- [x] **0.5.1 production parity audit/rebuild:** old 0.5.0 contained live transcription but lacked later token controls. Rebuilt Dev then standalone from current source; verified 44 packaged build-input application sources, live mode/1000 ms cadence, new controls, native modules, signing compatibility, logos, ZIP and 16 KB alignment. Ten JS test files and TypeScript pass; standalone is 63,011,476 bytes. No ADB device was connected; physical installation/audio/offline checks remain pending. See [release notes](docs/RELEASE_0.5.1.md).

- [x] **Separate living specifications:** [Product requirements](docs/PRODUCT_REQUIREMENTS.md) defines mission, MVP, features, acceptance and future scope; [Technical design](docs/TECHNICAL_DESIGN.md) records architecture, technology rationale, storage, runtime flows, tradeoffs and limits. README links both; update the relevant document alongside future changes and distinguish Dev preview from built artifacts.

- [x] **Flexible token controls (0.5.1):** reply presets 384/512/768, context presets up to 32768 when supported, sliders and validated custom integer fields. Defaults 384/2048; GGUF context ceiling checked before allocation, conservative unknown-metadata fallback, per-turn reply budget fits current input, context reload only on commit. Ten JS test files and TypeScript pass; Dev browser checks cover dragging, custom range validation and reload persistence. Packaged into both 0.5.1 builds; phone validation remains pending.

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
- [x] **Text sizing:** persistent global font-size presets (0.5×, 0.8×, 1×, 1.2×, 1.5×; new source default 0.8×, saved choices preserved), applied to screens, formatted chat and inputs.
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
- [x] **App information:** minimal creator credit (Parth Verma), without employer or detailed biography; app version, local processing/privacy, offline development-build requirements, TXT support and data-removal details.
- [x] **Project handoff documentation:** version/build distinction, installed library versions, development commands, architecture and storage notes recorded in README.



## Backlog

- [ ] **Optional web tools (Dev pilot):** source implementation and mocked checks complete: opt-in Search, local routing, one Brave request/turn, max three sources, evidence budget, sources, Stop, separate Worker and shared quotas. Dev proxy deployed at `https://phone-gpt-search.tensor0712.workers.dev`; Brave secret configured and one live proxy query passed (HTTP 200, three sources); pending A54 checks. Production feature remains disabled; no updated search APK released. See [plan](docs/WEB_SEARCH_PLAN.md).


- [ ] **Optional Google Drive backup/restore (planned, not implemented):** obtain provider clearance for the restricted app-content-backup use case; prototype portable encrypted archives and manual restore first, then direct account authorization/Drive uploads, immutable revision history, duplicate/conflict-safe merge, account/deletion isolation and a durable native outbox with background retry. Proposed hourly incremental batching/manual immediate runs use a durable coalescing outbox; match stable UUIDs plus revisions/hashes, treating timestamps only as hints. Explicit Link/Store/Import controls live under Settings → Backup & restore; repeated restore/retries must be idempotent. Scheduling is approximate, with eventual consistency rather than a 100% guarantee. No PhoneGPT account/chat backend required; no credentials or network integration added. See [detailed plan](docs/GOOGLE_DRIVE_BACKUP_PLAN.md), PRD and technical design.

- [ ] **Optional email/password accounts (after initial release):** optional home-page sign-in to identify voluntarily registered customers, separate FastAPI service and MongoDB Dev/Prod databases with matching `users` schema validators/indexes. Basic identity only; no chats/preferences uploaded. No resources provisioned now. Google sign-in deferred further. See [authentication plan](docs/AUTHENTICATION_PLAN.md).

- [ ] **Shared Dev/production storage:** signature-protected storage bridge for chats, attachments and model files; requires production and Dev native updates. User chose separate storage now and shared storage later; current builds retain independent storage.

- [ ] **Image chat:** download and load matching vision projectors (`mmproj`) for compatible models, run image-plus-text inference locally and render images in messages/history. Family capability labels alone do not enable this.
- [ ] **Image storage:** copy originals to private per-chat folders, persist references and clean up stored images when their chat is deleted.
- [ ] **Additional document formats:** local PDF/DOCX and other format parsing, useful errors and chunking/context budgeting for larger documents; decide OCR support for scanned pages.
- [ ] **Additional voice capabilities:** spoken responses/text-to-speech, more speech models and optional language selection.
- [ ] **iOS voice verification:** microphone recorder/permission source exists; compile, fix native issues and test runtime/memory/audio on a real iPhone.
- [ ] **iOS delivery:** compile/sign the prepared native project, verify inference/pickers and the background URLSession implementation, and deliver through TestFlight after account setup.

- [x] Website direct contact form: owner-supplied Formspree endpoint, submission/error states and updated privacy disclosure. Native app unchanged.

- Cloudflare Pages: `phone-gpt` static upload prepared; deployment/live verification status is recorded in the website README and verification notes. GitHub pushes alone do not update Cloudflare.

- [x] Cloudflare Pages website published: https://phone-gpt.pages.dev/ (November 4, 2026); browser homepage/Features checks passed. Static Direct Upload; GitHub Pages remains available.

Hosting update November 4, 2026: Cloudflare Pages (https://phone-gpt.pages.dev/) is the production website. Old GitHub Pages hosting is disabled; website source repository and APK Release assets remain public by owner request.

- Website automatic deployment: GitHub Actions workflow and encrypted Cloudflare secrets configured; initial deployment verification tracked in website docs.

- [x] Automatic Cloudflare deployment verified: first GitHub push-triggered build/check/publish run succeeded (41999464002).

- [ ] **Dev web-search UX verification:** test the search overlay and Stop/typing, “From the web” label, direct reply wording, and context usage including hidden evidence. Source and focused regression checks implemented; verify on A54 before production rollout.

- [ ] **Dev routing verification:** explicit search/no-search requests, current/historical officeholders, specific prices, and local definitions; Web defaults on for new preferences while saved off persists. Source/tests updated; verify revised routing and concise grounded wording on A54.

- [ ] **Verify compact Dev Web header:** toggle next to model under UUID, long model name truncation on A54, one-time explanation remembered across relaunch/toggle, and no composer disclosure. Source change and checks complete; device verification pending.

- [ ] **A54 follow-up after browser checks:** verify keyboard/safe areas and scrolling during native generation at 0.8×. Running browser Settings/model-list scroll, chat header/composer and draft reuse passed; automated chat follow/pause/resume regression passed. No device connected during these checks.

- [ ] **Local export A54 check:** Export icon beside Chat History; one All chats toggle (select/clear all), individual checkboxes, ZIP creation in a chosen folder, UUID text/JSON, timestamps/sources and attachments, cancellation and unavailable-attachment message. Implemented in Dev/shared source; unit and browser checks performed separately from native device verification.
- [ ] **Shared controls A54 check:** matching model/Web surfaces and consistent action/preset buttons in light/dark themes at 0.8×. Source implemented; verify long loaded model labels.

- [ ] **Export destination improvement:** consider Android Save As (`ACTION_CREATE_DOCUMENT`) in a native update so saving a ZIP to ordinary destinations such as Downloads does not request whole-folder access. Current Dev shows instructions to select/create a subfolder. OS-protected locations remain restricted.

- [x] **Uncensored catalog flag off (shared source/Dev):** hide uncensored entries from model families, downloaded selector and last-loaded restoration without deleting models/chats. Production APK rollout requires a new build.

- [x] **Generation Apply flow (source/Dev):** single editable number, staged sliders/presets/custom input, teal Apply for pending changes and subdued Apply after commit. Focused tests pass; included in verified standalone 0.5.5 / code 19.

- [x] **Standalone 0.5.5 / code 19:** production APK built and artifact-verified against 0.5.4 signer; includes export/UI/font/uncensored-flag/token-Apply updates. Web search remains Dev-only. Install and run A54 acceptance checks next.

- [ ] **Post-0.5.5 Dev check:** natural web answers without source/link narration, retained expandable sources, and manual scroll priority during streaming (small upward movement, touch, wheel/accessibility, momentum, keyboard/layout changes and queued Send frame). Parallel implementation/regression work; existing production 0.5.5 is unchanged.

- [ ] **Post-0.5.5 Dev voice check:** blank/silence markers filtered; ready audio processed serially immediately after prior decode, with 200 ms insufficient-audio readiness retries and 300 ms minimum fresh audio. Source and targeted tests pass; verify real A54 mic latency/corrections, Stop/cancel, background cleanup and typed-draft preservation. Existing production APK unchanged.

- [x] **Compact official-model catalog (source/Dev):** Qwen 3.5 2B, Gemma 3 1B Instruct and official DeepSeek R1 Distill Qwen 1.5B, Q4_K_M conversions, verified URLs/exact sizes and nonzero repository downloads; uncensored rollout remains off.
- [ ] **A54 new-model acceptance:** download/load each new entry, send a greeting and multi-turn recall, check Stop, memory pressure and storage cleanup. Model metadata/URL verification does not establish native inference compatibility. Include these entries in the next standalone build after Dev testing.

- [x] Context range expansion (source/Dev): fallback ceiling 32,768, explicit 10,000/20,000 presets, 2,048 default retained and known GGUF ceilings enforced. A54 memory/load checks remain pending; standalone APK unchanged.

- [x] **Theme colors (shared source):** six saved accent choices in Appearance; works with light/dark mode, wrapping controls, contrast and preference tests.
- [x] **Production parity source 0.5.6:** remove Dev-only web-search restriction; include latest catalog/context/voice/web-answer/scroll/export changes. Existing Worker quotas remain unchanged; uncensored models stay hidden.
- [ ] **0.5.6 A54 acceptance:** update existing production app, confirm chats/downloads retained; cold-start offline, change/reopen theme in light/dark modes, live voice with silence, manual scroll while streaming, 10k/20k context load, export ZIP and optional web search with source/context tracking.

- [x] Standalone 0.5.6/code 20 built and artifact-verified: 61 application sources match the current checkout, signer matches 0.5.5, embedded Hermes/features and native modules verified. Size ~63.2 MB. A54 installation and native runtime checks remain pending.

- [x] **Theme refinement source:** remove White/Sage blue, add Violet, migrate saved retired choices and preserve dark mode. Six palettes pass contrast/persistence tests.
- [ ] **Chats-first navigation proposal:** evaluate a main chat list with preview/search/new-chat, back from a conversation to that list, and Chats/Models/Settings navigation. Move App Info into Settings and use first-use onboarding for model setup. Discussed with owner; not implemented or included in the current APK.

- [x] **Standalone 0.5.7/code 21:** six-color refinement packaged and verified against the 0.5.6 signer; 61 source inputs matched. A54 install/runtime checks pending. Chats-first navigation is still only a proposal.

- [x] **Direct app contact form (source/Dev):** use website Formspree endpoint, remove inbox address/mailto, remove app message cap and limit wording, disclose submitted contact fields, prevent duplicate taps and preserve draft on failures. Mocked HTTP/timeout/long-message/UI tests pass; no live feedback email was sent.
- [ ] **Contact A54 acceptance:** submit an intentional message, verify Formspree delivery to the configured inbox; test offline failure, retained draft and long text. Chat-list navigation remains discussion/proposal only.

- [x] **Standalone 0.5.8/code 22:** direct contact form packaged; current sources, native modules, removed email, bundled endpoint and update signature verified. 164 tests passed; no live feedback submitted.
