# PhoneGPT project tracker

Last reviewed: 2026-11-09. Current shared source and verified standalone Android APK: **0.5.14**, version code **28**. Dev native APK remains 0.5.4 and receives current JS through Metro. Production bundles the same features; 64 build source inputs and update signature match verified. iOS metadata is 0.5.14 / 28, not compiled/signed. Physical-device checks remain pending.
Scope: private, on-device model downloads and chat in one mobile repository, with no chat backend. “Done” means implemented; outstanding physical-device checks are explicitly listed under To-do. Setup, dependencies, storage and source locations are in [README.md](README.md).

## To-do

- [ ] **A54 standalone update and offline acceptance:** install current 0.5.14 over the existing production app; verify retained chats/models, App Info version, cold offline launch, local chat and voice without Metro. Check the [device checklist](docs/A54_TEST_CHECKLIST.md).
- [ ] **A54 chat, navigation and presentation:** verify Home/Chats/Models/Settings, back navigation, existing chats, draft switching, search, selected deletion and recovery; check streaming/Stop and manual scroll, keyboard/safe areas, light/dark themes, accent colors, text sizes and accessibility.
- [ ] **A54 models, settings and prompts:** check both generation sliders, custom values and Apply/reload behavior; load models including Qwen 3.5 2B, Gemma 3 1B and DeepSeek R1 1.5B, test multi-turn recall, Stop, storage cleanup and context limits. Verify Preferred badge independent of loaded state, saved prompt history/restore/unsaved edits and large-text action row, default/custom/blank prompt persistence and existing chat snapshots.
- [ ] **Model RAM/device compatibility:** research exact quantizations and source-labelled estimates, distinguish download storage from runtime RAM, account for context/cache and simultaneous voice models, and measure standalone peaks on A54. Cover all catalog entries, starting with Qwen 3.5 0.8B and Whisper Tiny/Base; no minimum RAM is verified. See [research](docs/MODEL_MEMORY_RESEARCH.md).
- [ ] **A54 downloads and recovery:** test pause/resume, offline feedback, retry, cancellation, reopening and background lifecycle without duplicate tasks, for chat and voice models. Check error and load/retry labels; local inference must remain usable offline.
- [ ] **A54 voice acceptance:** test Whisper Tiny/Base and available voice models, permissions, speech/silence/noise, revisions, long recordings, editable drafts, Stop/Cancel, chat switching, background cleanup and offline transcription. Measure latency, CPU and memory; compare preserved recording mode. Live scheduling processes ready audio serially with 200 ms readiness retries, not a fixed one-second update promise.
- [ ] **A54 web search acceptance:** verify routing for explicit search/no-search, definitions, officeholders and prices; compact Web control and remembered explanation, search stages, Stop/typing, grounded answers, sources/links, context usage, limits and local fallback. Include long model labels and native scrolling.
- [ ] **A54 export and contact acceptance:** verify chat selection, ZIP destination, content/attachments, cancellation and missing-attachment reporting. Test direct contact-form validation, keyboard, long text, offline/failure draft retention and intentional submission/delivery if the user chooses; provider acknowledgement alone does not confirm inbox delivery.
- [ ] **Android store preparation:** complete [readiness audit](docs/PLAY_STORE_READINESS.md): AI safeguards and in-app reporting/delivery, review of the published privacy policy and OS backup decision, permissions, model licenses, Play App Signing enrollment/upload and split testing (local signed AAB built), target API and 16 KB checks, listing/declarations and applicable physical/closed testing. The contact form is not an AI-reporting flow.
- [ ] **Android size and release optimization:** measure Play download size, evaluate R8/resource shrinking, unused image-picker removal and engine variants while preserving inference compatibility; see [size plan](docs/APP_SIZE_PLAN.md).
- [ ] **iOS build, verification and delivery:** obtain Expo/Apple signing setup, compile the prepared project with CocoaPods/Xcode, fix findings and test inference, pickers, downloads, voice, permissions and memory on iPhone. Then prepare TestFlight and Apple privacy/listing/review requirements; no signed build exists. See [checklist](docs/IOS_BUILD_AND_TEST.md).

## Done

- [x] **Privacy policy access and delivery (0.5.14):** public policy identity/retention/deletion clarifications, About/contact policy actions and matching backup/search disclosures. AAB and standalone verified with their respective existing signers. Data safety form submission and device acceptance remain pending.

- [x] **Local Play bundle/signing preparation:** dedicated private upload key outside Git, fail-closed AAB signing and verified `PhoneGPT-v0.5.13-play.aab` (code 27). Source/certificate/bundle/generated-APK checks pass. No Play upload/enrollment or physical install; [handoff](docs/PLAY_BUNDLE.md).

- [x] **Production 0.5.13 and prompt history:** verified standalone/code 27 published on GitHub Releases and linked from the live Cloudflare website. Saved prompt versions, pinned original default and compact wrapping actions are included; physical A54 acceptance remains in To-do.
- [x] **Website copy cleanup (2026-11-09):** remove repeated model-download badges and redundant local/offline/model-choice explanations; keep setup/privacy information where it informs a decision. Product behavior and the production APK are unchanged.


- [x] **Website navigation/layout refinement:** homepage section navigation plus explicit Home shortcuts, inline expandable model catalog/full FAQ/downloads, compact model/detail-page spacing and corrected centered callout. Phone sample preview simplified at owner request. Static fragment checks and desktop/mobile review accompany the website update; mobile app behavior is unchanged.

- [x] **Public website implementation:** separate Next.js static website with ten product/setup/model/privacy/contact/release pages, model filters, founder feedback/model-request email handoff, mobile/desktop styling and SEO metadata. Parallel design/content/SEO reviews and production-output checks; GitHub Pages publication status is recorded in the website README. No mobile binary or store-readiness change.

- [x] **About/contact and model recommendation (0.5.3 builds):** removed employer/detailed biography; retained relevant app info and short creator attribution. Added validated name/email/message email-app handoff with preserved draft/fallback, no backend or automatic sending. Added editorial Preferred badge to Qwen 3.5 0.8B. See [release checks](docs/RELEASE_0.5.3.md).
- [x] **Store readiness review:** inspected target API, merged permissions, signing and packaged native alignment; documented concrete submission gaps and explicit iOS/Android launch tasks. This is not store approval.

- [x] **iOS source port / Android 0.5.2 parity:** generated iOS project and Apple-only Expo recorder/background-URLSession modules; wired existing live transcription/download contracts, permissions and separate Dev/Release identities, with EAS build profiles. Shared tests, TypeScript, autolinking, source-wiring checks and iOS production JS export pass. Rebuilt Android Dev then standalone and verified current sources/signing/native packaging. iOS Swift/native compilation, signing and device behavior remain unverified; see [release/handoff](docs/RELEASE_0.5.2.md).

- [x] **Backup multi-agent implementation planning:** three independent UX/data/Android reviews completed, with shared-contract, parallel write-scope, independent review and Dev/standalone gates in the [execution plan](docs/GOOGLE_DRIVE_IMPLEMENTATION_PLAN.md). Incorporated Home discovery, durable queue before manual uploads, branch identity/lineage and worker-claim corrections. Documentation only; Drive implementation/provider clearance remain backlog.

- [x] **0.5.1 production parity audit/rebuild:** old 0.5.0 contained live transcription but lacked later token controls. Rebuilt Dev then standalone from current source; verified 44 packaged build-input application sources, live mode/1000 ms cadence, new controls, native modules, signing compatibility, logos, ZIP and 16 KB alignment. Ten JS test files and TypeScript pass; standalone is 63,011,476 bytes. No ADB device was connected; physical installation/audio/offline checks remain pending. See [release notes](docs/RELEASE_0.5.1.md).

- [x] **Separate living specifications:** [Product requirements](docs/PRODUCT_REQUIREMENTS.md) defines mission, MVP, features, acceptance and future scope; [Technical design](docs/TECHNICAL_DESIGN.md) records architecture, technology rationale, storage, runtime flows, tradeoffs and limits. README links both; update the relevant document alongside future changes and distinguish Dev preview from built artifacts.

- [x] **Flexible token controls (0.5.1):** reply presets 384/512/768, context presets up to 32768 when supported, sliders and validated custom integer fields. Defaults 384/2048; GGUF context ceiling checked before allocation, conservative unknown-metadata fallback, per-turn reply budget fits current input, context changes save on Apply and require explicit Load model (current source; original builds reloaded on commit). Ten JS test files and TypeScript pass; Dev browser checks cover dragging, custom range validation and reload persistence. Packaged into both 0.5.1 builds; phone validation remains pending.

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
- [x] **Android native tooling:** local JDK/Android SDK setup, native Android project, custom development client and APK build workflow for native inference. The 0.5.0 standalone artifact was about 63 MB; native Android release build passed. The earlier voice APK is a Metro-dependent development build.
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




- [x] **Optional web search shipped:** opt-in Web mode, local routing, sources and context tracking, Stop, search limits and local fallback are implemented; standalone 0.5.6 and later include it. Proxy live-query and source checks are recorded in [the plan](docs/WEB_SEARCH_PLAN.md); A54 checks remain below.

- [x] Website direct contact form: owner-supplied Formspree endpoint, submission/error states and updated privacy disclosure. Native app unchanged.

- [x] Cloudflare Pages website published: https://phone-gpt.pages.dev/ (November 4, 2026); browser homepage/Features checks passed. Static Direct Upload; GitHub Pages remains available.

Hosting update November 4, 2026: Cloudflare Pages (https://phone-gpt.pages.dev/) is the production website. Old GitHub Pages hosting is disabled; website source repository and APK Release assets remain public by owner request.

- [x] Automatic Cloudflare deployment verified: first GitHub push-triggered build/check/publish run succeeded (41999464002).

- [x] **Uncensored catalog flag off (shared source/Dev):** hide uncensored entries from model families, downloaded selector and last-loaded restoration without deleting models/chats. Production APK rollout requires a new build.

- [x] **Generation Apply flow (source/Dev):** single editable number, staged sliders/presets/custom input, teal Apply for pending changes and subdued Apply after commit. Focused tests pass; included in verified standalone 0.5.5 / code 19.

- [x] **Standalone 0.5.5 / code 19:** production APK built and artifact-verified against 0.5.4 signer; includes export/UI/font/uncensored-flag/token-Apply updates. Web search remains Dev-only. Install and run A54 acceptance checks next.

- [x] **Compact official-model catalog (source/Dev):** Qwen 3.5 2B, Gemma 3 1B Instruct and official DeepSeek R1 Distill Qwen 1.5B, Q4_K_M conversions, verified URLs/exact sizes and nonzero repository downloads; uncensored rollout remains off.

- [x] Context range expansion (source/Dev): fallback ceiling 32,768, explicit 10,000/20,000 presets, 2,048 default retained and known GGUF ceilings enforced. A54 memory/load checks remain pending; standalone APK unchanged.

- [x] **Theme colors (shared source):** six saved accent choices in Appearance; works with light/dark mode, wrapping controls, contrast and preference tests.

- [x] **Production parity source 0.5.6:** remove Dev-only web-search restriction; include latest catalog/context/voice/web-answer/scroll/export changes. Existing Worker quotas remain unchanged; uncensored models stay hidden.

- [x] Standalone 0.5.6/code 20 built and artifact-verified: 61 application sources match the current checkout, signer matches 0.5.5, embedded Hermes/features and native modules verified. Size ~63.2 MB. A54 installation and native runtime checks remain pending.

- [x] **Theme refinement source:** remove White/Sage blue, add Violet, migrate saved retired choices and preserve dark mode. Six palettes pass contrast/persistence tests.

- [x] **Standalone 0.5.7/code 21:** six-color refinement packaged and verified against the 0.5.6 signer; 61 source inputs matched. A54 install/runtime checks pending. Chats-first navigation is still only a proposal.

- [x] **Direct app contact form (source/Dev):** use website Formspree endpoint, remove inbox address/mailto, remove app message cap and limit wording, disclose submitted contact fields, prevent duplicate taps and preserve draft on failures. Mocked HTTP/timeout/long-message/UI tests pass; no live feedback email was sent.

- [x] **Standalone 0.5.8/code 22:** direct contact form packaged; current sources, native modules, removed email, bundled endpoint and update signature verified. 164 tests passed; no live feedback submitted.

- [x] **0.5.9 source/Dev navigation:** Home retained; four bottom tabs; full Chats list, first-message titles, start timestamps, last-message previews, raw-transcript search, export and Settings → App info/contact. UUIDs remain internal.

- [x] **Safer chat editing:** remove row trash buttons; Edit, checkbox selection, matching Select all and confirmed Delete selected with partial-failure recovery.

- [x] **Readable previews:** conservative Markdown-to-plain display helper, preserving raw stored/searchable messages and literal symbols.

- [x] **Web routing and state:** 16-token YES/NO router with local fallback instead of a decision failure; explicit search requests preserved; filled Web on and neutral Web off.

- [x] **Standalone 0.5.9/code 23:** four-tab navigation with Home retained, first-message titles, readable previews, Edit/confirmed deletion and web fixes packaged; signer matches 0.5.8. 180 automated checks passed.

- [x] **0.5.9 GitHub publication authorized:** owner requested the push on 2026-11-07. Includes navigation, editing, preview formatting, web fixes and documentation. Native A54 acceptance remains separate; the earlier 0.5.8 sync was 7d3794e.

- [x] **Chat-row spacing (source):** show start time only; remove visible date label while retaining creation metadata, accessible full date and chronological ordering.

- [x] **Visible editable PhoneGPT prompt (source/Dev):** one shared default for normal/web answers, no Parth fallback, brief paragraphs/bullets, direct style and optional relevant follow-up. Preserve custom settings; saving blank visibly restores default.

- [x] Settings/context flow (source/Dev): preferences first, About last; context Apply stays on the page and requires explicit Load model before the next message. A54 validation pending.

- [x] Shared source/Dev: collapsed per-question search routing summaries, distinct search/generation stages, clickable supplied Markdown/bare links, and explicit model reload after saving a context change. A54 acceptance pending.

- [x] **Production 0.5.10/code 24 built:** all current shared Dev features embedded; 21 test files, TypeScript, source-map parity and signature checks pass. A54 install/runtime acceptance remains open; APK is local, not newly published to a download service.

- [x] Hourly-search source/Dev: first-reservation one-hour window, 10 per network, retained global 50/day; validated reset/start times and clearly labelled local fallback on 429. Worker deployed with dashboard-controlled limits; standalone 0.5.11/code 25 built and verified. A54 acceptance pending.

- [x] Compact inline web-search status and post-Send scroll regression fix (shared source/Dev). Automated coverage checks stale momentum versus a newer reading gesture. A54 acceptance pending.

- [x] Reported >10 searches resolved by owner testing: replies after the cap showed the search-limit/reset notice and local fallback, confirming blocked web lookups rather than extra allowed searches. Cloudflare variables remain 10/hour per network and 50/day shared. No raw-IP/query history logging was enabled.

- [x] Production 0.5.12/code 26 built and verified with compact search activity and Send-scroll fix. 22 test files and TypeScript pass; 64 packaged inputs match. A54 UI/scroll acceptance remains pending.

## Backlog

- [ ] **Optional Google Drive backup/restore:** obtain provider clearance; prototype portable encrypted archives and manual restore, then direct authorization, durable outbox/background retry, immutable revisions and conflict-safe, idempotent merge. Preserve account/deletion isolation; scheduling is approximate. See [plan](docs/GOOGLE_DRIVE_BACKUP_PLAN.md) and [execution plan](docs/GOOGLE_DRIVE_IMPLEMENTATION_PLAN.md).
- [ ] **Optional email/password accounts after initial release:** optional identity-only sign-in with a separate FastAPI service and MongoDB Dev/Prod databases; no chat/preferences upload. Google sign-in is deferred. See [plan](docs/AUTHENTICATION_PLAN.md).
- [ ] **Shared Dev/production storage:** explore a signature-protected bridge for chats, attachments and model files, requiring native updates to both variants. Storage is currently separate.
- [ ] **Image chat and storage:** locally load matching vision projectors, run image-plus-text inference and render images; store originals privately per chat and clean them up on deletion.
- [ ] **Additional document formats:** local PDF/DOCX and other parsing, errors and context-aware chunking; decide whether to support OCR for scanned documents.
- [ ] **Additional voice capabilities:** spoken responses/text-to-speech, more speech models and optional language selection.
- [ ] **Export destination improvement:** evaluate Android Save As (`ACTION_CREATE_DOCUMENT`) for ZIPs in ordinary destinations without whole-folder access; respect OS-protected locations.
