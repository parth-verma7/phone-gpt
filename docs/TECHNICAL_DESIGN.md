# PhoneGPT — Technical design

Owner: Parth Verma. Last updated: 2026-11-06.
Status: description of the current repository and explicit deferred decisions. Product behavior and scope are defined in [Product requirements](PRODUCT_REQUIREMENTS.md). Tasks and verification gaps are in [Project tracker](../PROJECT_TRACKER.md).

This document records the implementation and its rationale. Where earlier alternatives were discussed but no measured comparison was performed, the rationale below explains the current design's fit; it does not claim a benchmark or formal evaluation occurred.

## 1. Architecture and boundaries

One `phone-gpt` repository contains the React Native application, bundled catalogs, JavaScript services and Android/iOS native projects. There is no active FastAPI service, MongoDB database or hosted chat inference API.

The UI and orchestration run in TypeScript/React Native. Native llama.cpp bindings generate chat replies; a separate native Whisper runtime transcribes audio. Platform-native code owns recording and background transfers, whose lifetimes cannot depend on a React screen remaining mounted.

The important flows are:

1. Bundled catalog → model host download → app-specific model file → explicit native model load.
2. Composer + current chat + prompt snapshot + attachment contents → local tokenizer/budgeting → llama.rn completion → streamed UI → saved chat JSON.
3. Microphone → native private WAV → sequential Whisper windows → editable draft → ordinary chat send only when requested.

Network access is needed for model downloads and Dev's Metro connection. Standalone startup and inference with available files do not require a server. This keeps conversations off a mandatory backend and avoids network-dependent inference. It moves compute, memory, battery and compatibility constraints onto the user's phone.

## 2. Technology choices

### React Native, TypeScript and Expo native builds

Installed core versions: Expo 57.0.30, React Native 0.86.3 and React 19.2.3. TypeScript provides typed application/service boundaries. React Native supports a shared mobile UI while allowing the native inference and Android lifecycle code this product needs. This is not evidence that it is always smaller or faster than Flutter.

Expo supplies development/build integration and aligned filesystem/document-picker modules. Expo Go cannot include this project's custom native engines, recorder and transfer service; use the custom Dev app. The browser preview validates UI and JavaScript behavior, not native inference or Android lifecycle behavior.

`package-lock.json` pins resolved dependencies; use `npm ci`. See [README libraries](../README.md#libraries) for the fuller inventory. Keep Expo native package versions aligned: the earlier picker `AnyTypeProvider` failure illustrated why a changed JS bundle cannot fix an incompatible APK.

### Chat engine: llama.rn / llama.cpp

`llama.rn` 0.13.0-rc.7 provides native loading, tokenization, chat-template formatting, streaming and cancellation. Quantized GGUF files are downloaded separately. Quantization reduces model storage/compute needs; it does not replace the runtime that reads weights and performs inference.

Current initialization uses four CPU threads, zero GPU layers and `use_mlock` enabled on Android, disabled on iOS. These are current defaults, not a claim of optimal settings on every phone. A single loaded chat context avoids multiplying large model allocations. Load/unload and inference operations are guarded to prevent concurrent engine use.

### Voice engine: whisper.rn / whisper.cpp

`whisper.rn` 0.7.4 uses compatible Whisper `.bin` weights; `buffer` 6.0.3 supplies its JS wrapper dependency. A chat GGUF runtime cannot simply load these speech weights. Separate engines preserve the correct preprocessing and model architecture while still computing locally.

`expo-file-system`, `expo-document-picker`, AsyncStorage, `react-native-svg` and `react-native-safe-area-context` provide files, TXT selection, local persistence, icons and system-bar layout. Image picker remains an installed dependency but is not part of the active TXT-only attachment flow; removal is planned size work.

## 3. Application structure

- `App.tsx`: screen/conversation state, inference lifecycle, composer, streaming, prompt preparation, persistence orchestration and shared generation controls.
- `src/components/`: Home, drawer, model groups, history search/deletion, settings, message formatting and common controls.
- `src/services/localInference.ts`: the native chat runtime, prompt assembly, token counts, stream handling and stop lifecycle.
- `src/services/models.ts`: model definitions and download/file lifecycle, including native bridge/fallback handling.
- `src/services/tokenLimits.ts` and `src/components/TokenLimitControl.tsx`: token-range rules and sliders/custom fields.
- `src/services/textAttachments.ts`: UTF-8 validation, private copies, legacy migration and per-turn input expansion.
- `src/services/chatHistory.ts`, `chatSearch.ts`, `chatNavigation.ts`, `deleteChat.ts`: history labels/migration, local search, fresh-chat reuse and attachment cleanup.
- `src/hooks/useVoiceTyping.ts`, `src/services/liveTranscription.ts`, `liveDraft.ts`, `voice.ts`: voice lifecycle, window scheduling, transcript merging and draft edits.
- `src/theme/`: shared light/dark colors, saved global font scaling and scaled text components.
- `android/app/src/main/java/com/phonegpt/app/`: registered recorder/download bridges, foreground transfer service and resumable HTTP implementation.

The current application uses React state/refs and small services rather than an additional state-management framework. This keeps dependencies and coordination simple at this scale. `App.tsx` is substantial; further extraction is a maintainability option, not an implemented architecture rewrite.

## 4. Local data model and storage

### Conversations and preferences

All saved chats are one JSON array in AsyncStorage under `@phone-gpt/chats`, not individual per-chat JSON files. Each record contains `id`, `title`, `messages`, optional `createdAt`/`updatedAt`, a `systemPrompt` snapshot and optional Dev/production `origin`. Each message contains `id`, `role`, `content` and optional attachment references (`name`, `uri`, `size`).

An empty conversation has a draft UUID in memory; its persisted creation time is established at first send. +/New chat reuses an empty conversation and its draft/attachment; after messages exist it allocates a new one. History labels derive from the first user message (currently up to 24 characters) or attachment filename, and display creation time rather than last-message time. Older IDs/timestamps and inline attachments are migrated when history is restored.

Other AsyncStorage keys:

- `@phone-gpt/inference-settings`: reasoning mode, reply ceiling and context size.
- `@phone-gpt/system-prompt`: saved instruction for new chats.
- `@phone-gpt/theme` and `@phone-gpt/font-scale`: appearance preferences.
- `@phone-gpt/last-loaded-model`: last successful chat-model choice.
- `@phone-gpt/voice-model`: independently chosen voice model.

AsyncStorage is sufficient for the current local MVP without a database or server. The tradeoff is whole-history serialization, in-memory searching and limited scalability. History writes are queued so an older save cannot race behind a durable deletion and restore it. Streaming deltas stay in memory; replies/partial results are saved when generation settles rather than writing storage per token. Process death mid-generation can therefore lose unsaved output.

### Files and data removal

Native Android model downloads use app-specific external storage, normally `Android/data/<applicationId>/files/Download/models/`. Incomplete new transfers use `.part` files. iOS source uses Application Support/PhoneGPT/models with persisted URLSession transfer metadata/resume files in its parent, excluded from OS backup. Other chat/attachment data retains platform defaults; this is not a blanket iCloud-backup exclusion. iOS lifecycle behavior is unverified until a native build/device test.

TXT originals are copied under `FileSystem.documentDirectory/chats/<chatId>/attachments/`. Chat JSON stores references, not expanded file text. Voice WAV/snapshots live in private cache and are removed after completion/cancel/error; orphan recording cleanup runs at the next recording start.

Confirmed chat deletion removes that chat's private attachment directory, then durably saves the remaining history. Deleting an active chat resets the composer to a fresh chat. Models and original source documents are outside that deletion scope. This is not a filesystem/database transaction: if attachment deletion succeeds and history persistence fails, the chat may remain with unavailable attachments. Errors are surfaced; stronger transactional cleanup can be added later.

App updates with the same identity/signature normally preserve data. Uninstall/clear-data removes app-owned data. Dev and standalone have independent sandboxes; there is no implemented sharing bridge.

## 5. Multi-turn chat, context and prompt design

Every send prepares the full transcript of the current chat in order. It prepends one hidden system-role message using the conversation's saved prompt, or the default assistant prompt (currently named Parth). A new chat snapshots the user's saved prompt at its first send. This prevents later global prompt edits from silently changing an existing chat's instruction.

Saved conversations provide persistence, not cross-conversation retrieval. No summary memory, embeddings, vector search or cross-chat prompt injection is implemented. History substring search is a UI feature and does not feed other chats to the model.

The active template controls final model formatting. Reasoning Off/Short/Extended uses template kwargs and thinking budgets; support depends on the model. Raw generated reasoning is displayed. Formatting is applied by the message renderer rather than by altering saved model output.

### Flexible limits: available in 0.5.1

`maxTokens` and `contextSize` are integer settings rather than fixed TypeScript unions. Defaults remain 384/2048. Reply controls start at 384; context controls start at 1024. Quick presets are independent of slider maxima; custom fields reject non-integers and values outside the displayed range.

Before allocating a model context, `loadLlamaModelInfo` reads GGUF metadata. `general.architecture` identifies the matching `<architecture>.context_length` value. A valid value bounds the requested context; missing/invalid metadata uses an editable fallback ceiling of 32,768, without claiming verified model capacity. Settings are rechecked on load/switch. The reported training window is an upper bound, not evidence that the device can allocate it or produce useful output at that length.

The reply setting is bounded by active context minus a 256-token reserve. Each turn counts the prepared messages and hidden prompt, then uses:

```text
actual reply budget = max(0, min(requested reply ceiling,
                                active context - counted input - 256))
```

An input with no room left is rejected with a recovery message rather than silently discarding earlier chat messages. A large reply ceiling alone does not reject a smaller valid input; the actual budget decreases to fit. This is approximate budgeting: the reserve estimates template/special-token overhead, not exact serialized-template measurement.

The visible tracker counts the current conversation, including attachment content, but excludes hidden instructions/template overhead. Its number is intentionally different from request budgeting.

The dependency-free slider uses PanResponder with local preview state, logarithmic positioning and accessibility range/actions. It commits on release; custom values commit on Apply. This makes large ranges usable without adding a native slider dependency or repeatedly reloading a model while dragging. Context changes require reinitialization; a load failure leaves the model unready and offers normal recovery with a smaller window.

## 6. Generation and UI coordination

Only one completion runs at a time. The next draft remains editable while Send is blocked. New user messages explicitly scroll after rendering. Stream-following stops when the user scrolls up, and resumes on an explicit send. Updates show the first chunk immediately and batch later rendering updates at roughly 50 ms to reduce layout churn.

An AbortController carries Stop through request preparation and completion. Native `stopCompletion` is retried across the asynchronous chat-formatting/start boundary, then drained before another request uses the context. Available partial text is retained; stopping before any output does not fabricate a reply. Models cannot be switched/deleted during incompatible inference operations.

`ChatsScreen` uses a virtualized FlatList and existing pure local substring search/highlighting. `BottomTabs` provides Home/Chats/Models/Settings; App Info nests under Settings. The former drawer and full-screen search components are no longer mounted by App. Export remains a single modal and model selection is independently closed on navigation. Root Android Back maps conversation → Chats → Home → exit, and App Info → Settings. Keyboard-aware safe areas keep tabs out of the conversation/composer space. Search orders by creation time and does not contact a service.

Theme/font context and shared components keep controls consistent. Touch targets/icons do not shrink with text. Keyboard/safe-area behavior is implemented, but web screenshots do not establish correctness for Samsung keyboard or system navigation insets.

## 7. Catalogs and download lifecycle

`src/data/models.json` holds 13 chat variants, including provider, censorship labels, file URLs, filenames, sizes and compatibility/display data. `voiceModels.json` holds four English Whisper variants. Bundling catalogs avoids a required backend and keeps browsing available offline. Catalog changes require a code update; automatic remote catalog refresh is not implemented. Only runtime-compatible converted weights can be loaded, not any arbitrary model-host page.

New Android transfers run in `PhoneGptTransferService`, exposed through the existing custom React Native package. SharedPreferences `phone_gpt_transfers_v2` records checkpoints; older DownloadManager tracking uses `phone_gpt_downloads_v1`. Native ownership keeps progress independent of expanded model cards and JavaScript screen lifetimes.

`ResumableModelTransfer.java` validates HTTP ranges and file validators when resuming. If a server ignores Range, changes its file or cannot safely validate a checkpoint, it restarts rather than corrupting a model by appending incompatible bytes. Pause retains the prefix, Resume continues safely, and Cancel removes partial state/file. Existing DownloadManager tasks remain readable but cannot gain the new manual-pause semantics in place.

Connectivity uses Android network capabilities, not unrelated internet probe APIs. Affected downloads show No internet; manually paused tasks remain paused after connectivity returns. Foreground notification/service lifecycle and persisted state improve recovery but cannot guarantee execution after Force stop, uninstall or every Android scheduling restriction. Runtime lifecycle tests remain necessary.

## 8. Voice pipeline and tradeoffs

`PhoneGptRecorderModule.kt` records 16 kHz mono 16-bit PCM WAV and reports actual audio energy for the meter. `src/config/voice.ts` enables `live`; current Dev uses a 200 ms insufficient-audio readiness retry instead of a one-second interval. The preserved `recording` mode remains behind that flag for comparison/fallback.

Live mode initializes Whisper before capture, snapshots at most 12 seconds of audio with one-second overlap, and runs one transcription at a time. The serial scheduler immediately checks for fresh audio after decode/file cleanup; insufficient audio schedules one 200 ms timeout instead of a fixed transcription tick. It requires 300 ms of new samples, with Stop allowed to drain a shorter new tail inside a valid window. No identical snapshots are decoded twice and no jobs overlap. Overlap/word matching revises recent text and reduces duplicate boundary words. Stop flushes pending audio; Cancel/navigation/backgrounding clean up. There is no fixed 120-second recording cutoff, but finite storage/memory/battery still apply.

`LiveDraftEditor` protects manually typed text while updating dictation. Edits within recognized text freeze that portion and later speech appends. A simple energy gate skips silence; it is not a learned voice-activity detector. This is repeated windowed Whisper decoding, not a diffusion model or a guarantee of one-second recognition latency. Long-session behavior, noise and boundary accuracy need physical tests.

Chat weights can remain loaded while Whisper runs, so combined memory pressure matters. Tiny/Base are practical initial test choices; Small is offered for evaluation without a claim of equal performance on A54. Voice initializes lazily and missing native modules produce an actionable error. iOS recorder source now implements the same PCM/WAV/snapshot contract through an Apple-only Expo module, but native compilation and device audio tests remain pending.

## 9. Privacy and security boundary

There is no application chat-upload, authentication or telemetry service. Model-host requests still disclose ordinary download/network information to those hosts; Dev also connects to Metro. This is distinct from uploading conversation content.

AsyncStorage is not an application-encrypted vault. Files rely on platform app storage protections; the app adds no custom database encryption. `allowBackup` is currently true, so OS-managed backup must be reviewed before promising that every byte always remains solely on-device. Temporary audio cleanup and per-chat file deletion reduce retention but are not secure-erasure guarantees.

Secrets, signing keys, model weights and APKs are excluded from Git. Model publishers' licenses, file authenticity/integrity policy and catalog compatibility need continued review; resumable-transfer validation is not a cryptographic trust guarantee.

Optional email/password accounts with a separate backend/MongoDB Dev/Prod setup are a [future proposal](AUTHENTICATION_PLAN.md), not a dependency of this architecture. Sharing Dev/prod storage would require an explicitly designed signature-protected native bridge and updates to both binaries; it is deferred.

## 10. Builds, updates and release strategy

Standalone is `PhoneGPT` / `com.phonegpt.app`; Dev is `PhoneGPT Dev` / `com.phonegpt.app.dev` with its own deep-link scheme. The same source supplies both. Different identities permit side-by-side testing but intentionally isolate data.

Debug uses Metro/Fast Refresh (normally port 8083). Release uses embedded Hermes bytecode and `useDevSupport = BuildConfig.DEBUG`; Expo Updates is disabled. JS-only changes can reach Dev over Metro. Native changes and app icons require a compatible new APK; standalone changes always require a rebuilt APK today. There is no configured OTA update service.

Current standalone Android artifact is 0.5.9 / code 23, described in [release notes](RELEASE_0.5.6.md). The latest native Dev APK remains 0.5.4 / code 18 and loads current 0.5.9 JavaScript through Metro. Expo iOS metadata is 0.5.9 / build number 23; no signed iOS artifact exists. Web search is enabled by the same explicit environment flag in both variants. Updating standalone replaces its embedded code; Dev reloads JS without reinstalling. Source parity, packaged-artifact parity and installed-device versions are tracked separately.

Build commands select ARM64 plus `rnllama,rnllama_v8_2` instead of every engine variant, retaining generic and supported FP16 CPU paths. Downloaded weights are not packaged. The 0.5.3 Android standalone is 63,018,588 bytes; Dev is 102,412,459 bytes. These are local APK sizes, not Play download or installed sizes. Further shrinking/removing unused dependencies needs compatibility checks; see [size plan](APP_SIZE_PLAN.md).

Current personal APKs retain the previous local debug signing certificate for updates. A dedicated upload/Play signing workflow, AAB, privacy/backup decisions, license/policy review and store submission remain future release work. Store requirements must be checked at submission; this document is not a compliance certification.

### iOS source preparation and remaining native gate

`ios/` is generated with Expo prebuild without regenerating Android. `modules/phone-gpt-ios` is an Apple-only local Expo pod; autolinking registers `PhoneGptRecorderModule`, `PhoneGptDownloadsModule` and `PhoneGptBackgroundSessionSubscriber`. JS lazily loads iOS modules through Expo; Android retains its existing React Native bridges.

The iOS recorder uses AVAudioEngine and AVAudioConverter to produce private 16 kHz mono Int16 WAV, meter events and bounded snapshot slices. Stop drains queued PCM writes before finalization. Native microphone permission and event subscriptions integrate with the shared Whisper/draft lifecycle. Audio is foreground-only; routes, interruptions, cleanup and conversion need physical validation.

The transfer manager uses background URLSession, a serialized delegate queue, generation-tagged tasks, atomic metadata/resume files, completion checks and bounded transient retry. An Expo app-delegate subscriber reconnects background sessions without hand-editing the generated app delegate. Weights stay out of OS backup. Pause/resume depends on usable OS/server resume data; failure can require Retry from scratch. Apple can delay/cancel background execution, particularly after user force-quit. These Swift implementations are not claimed compiled or runtime-proven.

`plugins/withPhoneGptIOS.js` keeps Debug/Release bundle IDs, display names and URL schemes separate even when regenerating the project. `eas.json` selects Debug/internal development and Release/store profiles. Memory-expansion entitlements from the llama plugin are explicitly disabled; availability/approval and actual iPhone memory capacity are not assumed. CPU inference is shared; no Metal performance claim.

The existing Ubuntu machine has no Xcode/Apple SDK; no Apple/Expo account or signing setup was supplied. EAS can provide the macOS build host, but a signed TestFlight route still requires those accounts and distribution setup. No EAS build, account creation, credentials upload or TestFlight submission was performed. The [iOS handoff](IOS_BUILD_AND_TEST.md) separates source checks from compile/sign/device gates.

### About contact and catalog recommendation

`ContactForm` keeps its draft only in component state. `contactForm.ts` validates required fields and name/email syntax, then sends an HTTPS JSON POST to `https://formspree.io/f/mljjawvn` with an Accept JSON header. This is the owner-authorized website endpoint, not an inbox address or secret. The payload contains only name, email, message and a fixed feedback subject. No chat/attachment metadata, account database, PII logging or local form persistence is added. The old mailto/Linking path and recipient constant are removed. The About ScrollView still handles taps while the keyboard is open.

A synchronous in-flight guard prevents duplicate taps; inputs are disabled while pending. A 20-second abort/timeout and safe generic failure preserve drafts without displaying provider bodies. There is no automatic retry because timeout does not prove the provider rejected a request. A successful HTTP acknowledgement clears fields and reports submission rather than guaranteed delivery. Message validation checks nonblank content only, with no TextInput maxLength or application cap; provider payload/quota/spam limits still apply. Internet access and Formspree processing are disclosed beside Send. Tests use mocked transport and do not send real feedback.

The optional catalog `preferred` flag renders an accessible, theme-scaled Preferred label for Qwen 3.5 0.8B only. It does not change load state, ordering, download behavior or model capability, and uses no popularity/network API.

The [store readiness audit](PLAY_STORE_READINESS.md) records actual APK/manifest/signing checks separately from missing policy, account and device evidence. No content filter/reporting service, signing migration or Android backup-policy change was silently introduced by this review.

## 11. Verification and known limits

Use `npm test`, TypeScript and the native HTTP fixture tests for affected behavior. Eleven current JS test files cover navigation, history search/deletion, token limits/native parameter mapping, downloads, Stop, voice scheduling/draft behavior, saved model recovery and text scaling. Fixtures exercise resumable-transfer failure paths as well as happy paths.

`scripts/verify-android-builds.py` checks APK identity/version, signatures, embedded feature markers/native modules, packaged icons, ZIP integrity and alignment. `scripts/analyze-apk.py` inspects size groups, unexpected model payloads and ELF alignment. The verifier also compares all local application sources in the production packager source map with the current checkout, checks the live-mode flag/cadence, and matches the APK bundle to the generated Hermes output. Run build verification after rebuilding, not as evidence that an older APK contains new source changes. These are build-input/artifact checks, not proof of physical microphone accuracy or latency.

Physical acceptance remains in the [A54 checklist](A54_TEST_CHECKLIST.md): inference quality/multi-turn recall, memory/load failures, keyboard/scrolling, permissions, live dictation, background transfers, compatible updates and airplane-mode cold-start. No remote observability stack is required now; use visible errors, local diagnostics and deliberate user feedback.

Known design limits include whole-history JSON storage/search, approximate prompt budgeting, nontransactional attachment deletion, system-controlled background execution, no cross-chat memory, no active image/PDF/DOCX path, no shared Dev/prod storage and incomplete iOS native delivery.

## 12. Proposed Google Drive backup — not implemented

See the [detailed backup/restore plan](GOOGLE_DRIVE_BACKUP_PLAN.md). This would be a direct mobile-to-Drive integration, separate from the optional PhoneGPT-account proposal. It needs Google authorization and provider clearance, but no PhoneGPT chat-storage server. Prefer a visible user folder and narrow per-file scope if restore/reinstall testing confirms access behavior; do not assume a scope exemption from Google's backup restrictions.

Proposed design: versioned encrypted per-conversation archives, original IDs/timestamps/prompt/attachment bytes, immutable revision IDs and parent ancestry, retry-stable remote IDs, per-device local change counters, canonical logical-content hashes, checksum/restore validation and an explicit safe merge that retains divergent branches. Local file paths and credentials must never enter the portable archive. Cross-device recovery needs a portable recovery key; a device-only key cannot solve reinstalls.

Reliable automatic work would require a native-accessible durable outbox and transactional chat repository (proposed Room/SQLite migration from the current AsyncStorage array), plus constrained WorkManager jobs. A screen timer cannot guarantee uploads when JS is absent. Default to hourly bounded batches (initially 20 chats per pass, one upload at a time); a manual Store action joins/starts the same unique runner. Coalesce pending changes by account/environment/chat, retain immutable in-flight snapshots and requeue any edit made during upload. Upload completion must clear only the revision/change sequence actually backed up, and workers must respect deletion/account/consent state. UUID matches identify candidates; timestamps alone cannot establish freshness across devices. Use causal ancestry/hashes for skip/update/conflict decisions. Stable restore-origin mappings prevent repeated conflict copies. The expected consistency model is eventual with explicit conflict reconciliation, not an absolute guarantee. Manual archive export/import comes before unattended backup; current storage/runtime are unchanged.

The plan covers idempotent restore, local/cloud deletion separation, branch conflicts, app removal, account switching, revoked access, quota/storage/network errors, process death and bounded resource use. Android schedules are approximate. Neither the workers, encryption, schema migration nor Google connection is implemented or packaged. Google's terms and Workspace policy are an explicit feasibility gate; do not enable backup merely because the API is technically accessible.

The [implementation work packages](GOOGLE_DRIVE_IMPLEMENTATION_PLAN.md) separate UI, portable archive/restore logic and Android persistence. Freeze shared types first, reserve App/Gradle/package registration for one integration owner, and run independent data/lifecycle/UX review before release. Planning reviews identified corrections: preserve portable conversation/branch identity separately from local conflict-copy IDs; retain verifiable ancestry descriptors through coalescing; treat a reused revision ID with different payload as corruption; and scope import verification receipts to the actual source destination.

A native database claim with a recoverable lease/fencing token must serialize manual and periodic runner entry points. Migration precedes all live Drive uploads; local archive export/import can come first. Test account identity binding, worker token reacquisition and historical child-file access after reinstall as post-clearance spikes. Derive the namespace from native build identity, review OS backup exclusions, and keep feature gates at authorization/scheduling/request dispatch. Home promotion uses a persisted dismissal and typed service availability, without triggering authorization on render; current unconditional on-device privacy wording needs an opt-in-aware audit before enabling cloud features.

## 13. Maintaining this document

Update this document alongside changes to architecture, runtime/dependency choices, storage/data models, prompt/context handling, native lifecycle, privacy, build/update delivery or operational limits. Record the reason and tradeoff, not only the new implementation. Update the PRD when user-visible behavior changes, the tracker for outstanding work, and release notes only when a new artifact is actually produced. Keep future proposals clearly separate from implemented design.

## Public website delivery

The separate `phone-gpt-website` project uses Next.js App Router, React and TypeScript with a static export, served through GitHub Pages under `/phone-gpt-website/`. There is no Node runtime, database or secret needed in production. GitHub Actions installs pinned dependencies, typechecks, exports, verifies route metadata/links/assets and deploys the output. Next Link and prefixed asset helpers preserve the project basePath. A copied catalog snapshot supplies client-side family/search filters; it must be kept aligned with the app catalog.

Founder messages/model requests use client-held fields and an encoded fixed-recipient mailto body, with explicit email-app review/sending and no printed inbox address. No form POST, automatic email delivery, telemetry or app-chat upload is introduced. Hosting IP logs, email-provider handling and existing Android backup caveats are disclosed in the site’s initial privacy notice. Metadata, self-canonicals, a sitemap and factual software JSON-LD support discovery without fabricated reviews or ranking promises. The site uses a visibly illustrative phone conversation; it is not live browser inference. Native mobile behavior and APK contents are unchanged by the website.

The website form is disabled in initial HTML until its client handler is installed, preventing native GET fallback from placing submitted fields in a URL if scripts are unavailable. Its destination is configured separately as tensor0712@gmail.com; the native app contact setting is unchanged. Public FAQ/privacy enquiries link to the form, not a printed email. Public copy excludes developer-facing implementation progress; those details remain in repository documentation.

Website section navigation uses basePath-aware Next Link hash targets and a sticky-header scroll offset. Shared FAQList and DownloadSection render on the homepage without duplicating their content rules; ModelExplorer is available in a native details disclosure. Static verification validates target IDs in exported files and the Back to Home shortcut on all detail pages. Detail wrappers scope denser spacing; callouts are nested within the centered wrapper so their own margins cannot shift the whole section. This is a website-only change.

Website contact delivery follow-up: a hosted form endpoint is proposed for direct submissions without exposing email credentials in client code. No endpoint, third-party contact submission or service activation has been configured yet; maintain current mailto behavior until the owner supplies a verified destination, and update privacy copy when enabling the service.

Website contact update (November 4): the owner supplied a Formspree endpoint. Website messages now submit directly without an email app; loading, duplicate-click prevention, success confirmation and draft-preserving error/timeout handling are provided. Formspree processing/retention is disclosed in website privacy. Native app contact behavior is unchanged. No chats are uploaded.

Website hosting: Cloudflare Pages is being prepared as an additional static deployment. Public build-time base-path/origin settings support both root hosting and the existing GitHub Pages project path. Native app behavior is unaffected; Cloudflare account access and live deployment verification are pending.

Cloudflare project `phone-gpt` uses Direct Upload with a production static export built using an empty NEXT_PUBLIC_BASE_PATH and NEXT_PUBLIC_SITE_URL=https://phone-gpt.pages.dev. No Cloudflare GitHub app permissions, Worker runtime or email credentials are added. Future updates require rebuilding and uploading to the existing Pages project; GitHub Pages retains its independent default build.

Hosting update November 4, 2026: Cloudflare Pages (https://phone-gpt.pages.dev/) is the production website. Old GitHub Pages hosting is disabled; website source repository and APK Release assets remain public by owner request.

Website deployment automation (November 5, 2026): pushes to website repository `main` build and validate the static export, then publish to the existing https://phone-gpt.pages.dev/ address through GitHub Actions/Wrangler. Deployment credentials reside in encrypted repository Actions Secrets, not website source/build output. Pages Write permission is scoped to the Cloudflare account. Initial automated deployment verification is tracked in the website verification document.

Automatic website deployment verified November 5: first push-triggered GitHub Actions run 41999464002 succeeded, including Cloudflare publishing. Changes to website `main` now update the existing production URL after checks pass.

Website visual alignment (November 5): model discovery, setup and contact share bounded panels with consistent pale green tint, corner radius and responsive page gutters. Very narrow headers omit the secondary download CTA to prevent crowding. Mobile app UI is unchanged.

## Planned memory estimation and device validation

The catalog’s `minFreeBytes` controls disk-space checks only. Planned RAM guidance combines GGUF identity/architecture/cache metadata with selected context and measured native process overhead, including a concurrently resident voice model. Hybrid/recurrent models require architecture-specific handling. No fixed multiplier of file size establishes peak RAM. Use Android system memory information and standalone PSS/RSS measurements across load/prefill/generation/voice; retain evidence, settings and unknown/estimated/measured status locally. No telemetry service or runtime enforcement is implemented in this research task. See [research and measurement protocol](MODEL_MEMORY_RESEARCH.md).

## Optional web search — implemented Dev source

`src/config/webSearch.ts` gates Search with `EXPO_PUBLIC_WEB_SEARCH_ENABLED` in both Dev and production as of 0.5.6. `EXPO_PUBLIC_WEB_SEARCH_API_URL` contains only the public proxy URL. No provider or pilot credential enters the app. `App.tsx` classifies the submitted question, optionally asks the local model for a short YES/NO routing decision, then makes at most one search request. Conversation history and attachments remain local. Evidence is labelled untrusted, capped at three sources and a measured 600-token delta, and fitted against the actual conversation/reply budget. Streaming, Stop and navigation cancellation cover the network phase and subsequent local generation. Provenance is stored with the assistant message in existing local chat JSON. Citation markers are bounded to returned IDs; this does not prove factual entailment.

The separate `../phone-gpt-search` Cloudflare Worker holds `BRAVE_SEARCH_API_KEY` and `RATE_LIMIT_SALT` as runtime secrets. A single SQLite-backed Durable Object reserves a maximum of 50 searches per UTC day globally and ten per IP per minute before upstream calls, including failures. It stores hashed IP counters, not chats or queries. The upstream endpoint is fixed, with timeouts and body-size limits; neither proxy nor app fetches source pages. Anonymous endpoint access is an explicitly approved Dev pilot with residual quota-exhaustion risk. Default checked-in service configuration remains disabled. Do not reuse the website Pages deployment credential. Cloudflare/Brave still handle search query traffic under their own policies.

Mocked client, routing, grounding and Worker tests pass; live provider, deployment runtime and A54 validation are separate requirements, not proven by mocks. No standalone APK containing this feature has been shipped. See [plan and rollout status](WEB_SEARCH_PLAN.md).

### Grounded-turn usage and presentation

The prior visible count used saved transcript text and omitted ephemeral search evidence. `WebContextUsage` now records input tokens (including the grounding prompt/evidence), the additional web-input delta, output tokens, model ID and context size. The active snapshot is scoped to the current user message; completed/stopped replies persist usage in their existing local message JSON. `resolveWebUsage` chooses only matching conversation/model/window data. A subsequent turn supersedes that snapshot, avoiding re-adding historical evidence that is not reinjected. The UI explicitly calls the completed snapshot “Last web turn.” Input tokenization uses the existing text representation rather than the full native chat-template serialization, so the visible count remains approximate. Streaming output uses a cheap character estimate, and completed output is tokenized after native completion settles; no tokenization occurs per streamed native event.

`WebSearchOverlay` is a non-intercepting app status inside the message viewport; navigation/composer/Stop remain outside it. Search preparation finishes before the phase switches to generation. The answer prefix is rendered by the app, not entrusted to model wording. Prompt changes discourage routine postscripts without suppressing specific uncertainty. Existing saved answers are not rewritten.

Cloudflare provides aggregate Worker request/error/CPU metrics. Detailed logs, traces and issues collection remain disabled, confirmed in the dashboard during setup. There is no user identity/authentication or chat/query logging added for observability. The quota Durable Object stores short-lived HMAC-derived IP counters, not user profiles; these are rate-limiting state, not a customer analytics dashboard.

Dashboard verification: the Worker Metrics tab exposes invocations, subrequests, runtime errors and timing charts, but was still displaying “No data” during this check. Do not claim populated counters were verified. These are service metrics, not an app usage/user identity dashboard, and runtime error counts do not automatically classify all handled provider HTTP errors. No custom successful/failed-search counters were added.

### Search routing/default follow-up

Dev preference restoration defaults to enabled only when no saved value exists, preserving a saved false. Deterministic explicit web requests bypass the local router and can authorize that one turn while the toggle is off; explicit no-search wording wins and prevents a lookup. Definition checks precede freshness/officeholder rules. Current and historical officeholder questions and price/population questions route deterministically; uncertain detailed historical facts are covered by the local JSON routing prompt. Per-turn web activity is tracked separately from the saved preference so navigation/Back cancellation also covers explicit one-turn searches. Grounded response instructions ask for direct, confident, query-specific facts/numbers with their units/dates and little additional context, avoiding generic doubts/disclaimers while retaining disclosure of actual missing/conflicting evidence.

### Compact Web control and one-time disclosure

`WebSearchControls` now renders only an accessible compact switch in the header model row. The model selector shrinks and truncates its label so the toggle remains visible on narrow screens. The repeated composer disclosure/status is removed; search progress remains in the dedicated overlay. AsyncStorage key `@phone-gpt/web-search-disclosure-v1` records acknowledgement independently of the on/off preference. An effect opens one non-cancelable informational alert when Web is enabled, preference loading is complete and Chat is visible; this also covers default-on users. A ref prevents duplicate alerts during re-renders. “Got it” marks the notice seen for the session and persists it; storage failure permits a reminder on a later launch. Clearing application data resets it; clearing only the OS cache normally does not erase AsyncStorage.

### Default text size and scroll verification

`DEFAULT_FONT_SCALE` is 0.8 for the provider's initial state and context fallback. A valid persisted preference (including 1×) still wins; missing/invalid values use 0.8×. Settings labels 0.8× as Default and retains all presets and full-size touch targets. This is a source/Dev update; existing standalone APKs require their next rebuild.

Verified the running web app at a 404px-wide viewport: Settings scroll reached its bottom (654px offset in 1458px content/804px viewport), expanded Voice/Qwen model lists reached the bottom (967px offset in 1771px content/804px viewport), reverse scrolling worked, and the header stayed visible. Checked chat header/composer and typing; New chat preserved the current empty UUID/draft. Automated chat handler regression covers following new content, suspending follow while reading older messages, and resuming within 64px of the bottom. No Android device was attached: live native inference scrolling and Samsung keyboard/insets were not verified by this browser check.

## Local chat export implementation

`ChatExport` is a modal launched after drawer dismissal, sharing the existing Android/iOS-safe navigation lifecycle. It uses one All chats checkbox toggle to select/clear the list plus individual checkboxes; disables overlapping export operations and prevents close during saving. `chatExport.ts` creates a versioned manifest, UUID-named text/JSON transcripts, and portable attachment files using JavaScript-only `fflate` 0.8.2. It preserves content/metadata but replaces device-local attachment URIs with archive-relative paths; filenames never become archive paths. IDs and duplicate IDs are validated, missing attachments recorded, and aggregate uncompressed payload is bounded at 25 MiB to keep phone memory use bounded (large exports require batches). Models and app settings are excluded. The archive is unencrypted; importing it is future work.

`chatExportDevice.ts` uses existing Expo FileSystem legacy Storage Access Framework on Android: request a folder, build the archive, create a ZIP document and write Base64 bytes. Cancellation before build writes nothing; failed writes attempt cleanup. Browser export uses a Blob/object URL and download link, later revoked. Neither path contacts a service. No new native module is introduced and Dev receives the JS update without reinstall; iOS file delivery is not implemented. Unit tests round-trip ZIPs and cover selection, UTF-8, metadata, attachment portability/failures, unsafe paths, empty/oversized inputs, Android cancellation and failed-write cleanup. Native folder picker/write still needs A54 validation.

`controlStyles.ts` centralizes 44-point control targets, 12-point corner radius, shared label metrics and themed neutral surfaces/feedback. Header model/Web controls, New chat/history actions, shared action buttons and settings presets reuse these values. This retains purpose/selection colors while avoiding unrelated shapes and inconsistent weights.

Android destination limitation: the existing folder-permission flow uses `ACTION_OPEN_DOCUMENT_TREE`; Android 11+ blocks selecting internal-storage/SD roots, Downloads itself, and protected Android/data or Android/obb folders. The export screen therefore guides users to create/select a subfolder such as Downloads/PhoneGPT. This copy change does not remove the OS restriction. A future `ACTION_CREATE_DOCUMENT` Save As native flow could target ordinary locations such as Downloads without requesting whole-folder access; that would need native implementation and an updated APK. See Android's [Storage Access Framework documentation](https://developer.android.com/training/data-storage/shared/documents-files).

### Uncensored catalog rollout disabled

`UNCENSORED_MODELS_ENABLED` is false in shared Dev/production source. The central model list filters uncensored entries before provider grouping, downloaded-model selection and last-loaded restoration. Empty families/sections are omitted; catalog metadata is retained for a future explicit rollout. A Fast Refresh selection that becomes hidden is reset and unloaded. No model files or conversations are deleted. This is a visibility rollout decision, not a Play Store approval certification. Dev updates on reload; existing standalone APKs need rebuilding to include it.

### Token control pending/committed state

`TokenLimitControl` now separates draft preview/custom text from the committed `value` prop. All three input paths stage changes; Apply validates and calls `onChange` once, while parent value/min/max changes reset the draft. Accessibility increments stage changes too, and terminated gestures restore their prior draft. The old repeated numeric label above the slider is removed. Apply's disabled state and primary/subdued surface derive from numeric validity and whether the draft differs from the committed setting. This prevents repeated context reloads before explicit confirmation. Focused tests cover both labels, presets, drag staging, disabled/unchanged/invalid Apply, and removal of the duplicate heading value.

Production 0.5.5 artifact verification matched 59 packaged application sources to the checkout and checked Hermes output, native modules, logos, Android identity/version, ZIP integrity/alignment and signing-certificate compatibility against standalone 0.5.4. This is build/artifact verification, not native A54 runtime validation.

### Post-0.5.5 scroll-intent correction

The earlier follow tracker updated only during native drag/momentum callbacks, resumed merely from being within 64px of the bottom, and a post-Send animation frame unconditionally restored follow mode. `App.tsx` now handles every scroll event, compares offsets with prior content/viewport geometry, and treats upward movement as a pause even near the bottom. Only downward movement within 24px can resume. Touch start pauses immediately; end/momentum events do not resume merely because the offset stayed near the end. Layout/content-size movement outside a gesture is not interpreted as an upward user scroll. Browser wheel-up and upward navigation keys proactively pause. The queued post-Send frame uses the same guarded `scrollToLatest` callback, so newer user intent wins. Conversation changes reset geometry. Native device reproduction still needs A54 verification; these fixes are not in the pre-existing standalone 0.5.5 artifact.

### Natural grounded-answer presentation

The grounded-answer instruction is compact and asks for a direct answer with short relevant context, not source-by-source narration. Source attribution is rendered in existing `WebSources` below the answer. Display sanitization removes leftover numeric citation markers and their adjacent spacing while preserving Markdown code, fenced JSON, array subscripts and explicit links. It does not regex-delete explanatory sentences or rewrite previously saved conversations. Small-model instruction adherence still requires device checking.

### Post-0.5.5 Dev voice implementation

`cleanTranscript` removes known bracketed non-speech markers and Whisper control tokens before live/recorded draft callbacks and before overlap text becomes future prompt context. Real surrounding text and arbitrary bracketed words remain. `LiveTranscription` now serializes snapshot/decode/cleanup, immediately checks fresh samples after settled work, and uses `LIVE_TRANSCRIPTION_READINESS_MS=200` only while waiting for enough new audio. Snapshot total size alone cannot trigger repeated work: end-sample advancement must contain 0.3 seconds of fresh audio, except the final tail. Native meter events do not include sample counts, so this is bounded snapshot readiness checking rather than a new push-PCM runtime. Native APIs/dependencies are unchanged. Tests cover marker filtering, decoded text, duplicate/silent/minimum audio, cleanup serialization, abort and Stop flushing. Device microphone/latency checks remain pending; standalone 0.5.5 is unchanged.

### Compact-model catalog verification

Catalog additions use existing GGUF download/load paths and a 2,048-token initial context, without native/dependency changes. Verified on 2026-11-06 against Hugging Face API metadata and HEAD responses: Qwen3.5-2B-Q4_K_M.gguf (Unsloth), 1,280,835,840 bytes; google_gemma-3-1b-it-Q4_K_M.gguf (Bartowski), 806,058,496 bytes; DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf (Bartowski), 1,117,320,800 bytes. Their conversion repositories had nonzero downloads (roughly 464k, 24k and 41k respectively); popularity is not a runtime compatibility guarantee. Original release provenance: [Qwen](https://huggingface.co/Qwen/Qwen3.5-2B), [Google](https://huggingface.co/google/gemma-3-1b-it), [DeepSeek](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B). Community conversion publishers are distinct from original model publishers.

Free-storage gates allow temporary transfer overhead; they are not estimated RAM requirements. Existing Gemma 4 GGUF metadata now uses its exact 3,349,516,256-byte size and matching source repository. Gemma E2B effective parameters must not be presented as total parameters ([Google model card](https://ai.google.dev/gemma/docs/core/model_card_4)). Catalog capabilities reflect this app's text-only support, without vision projectors or image inference. No weights were downloaded during verification; native load, generation, chat-template behavior and A54 memory/latency remain acceptance checks. Uncensored rollout stays disabled in both build variants; the central visibility filter remains active.

The unknown-metadata ceiling is now 32,768 consistently in the editor, saved-setting normalization and native allocation path. This is an opt-in fallback ceiling, not a larger default or a validated training window. GGUF architecture-specific limits still override it. Context preset choices include exact 10,000 and 20,000; all changes remain staged until Apply. Regression coverage checks these requests and enforcement of a smaller known limit.

### Appearance palette persistence

`theme/themeColors.ts` defines six semantic palettes and validates stored accent IDs. `AppThemeProvider` hydrates the existing light/dark key plus `@phone-gpt/theme-accent` before persisting either, then memoizes semantic colors shared throughout the app. Invalid/missing accents use Teal. `ThemeColorSettings` is a wrapping, accessible radio group with 44-point targets. Color selection is independent from dark mode; Retired Sage blue preferences migrate to Light blue; White preferences return to Teal without changing light/dark mode. Existing status/error colors retain their semantic meaning. Tests exercise foreground/background contrast in both modes and preference hydration/persistence. No native dependency is added.

### Production parity release 0.5.6

The `__DEV__` restriction was removed from `WEB_SEARCH_FEATURE_ENABLED`; both variants now honor the same explicit build-time environment flag and Worker URL. The release build embeds that public proxy endpoint, not Brave credentials. Existing Worker quotas remain unchanged (50/day total and per-client throttling), so enabling production does not increase provider spend caps. Runtime Web off stays respected except explicit one-turn search requests. The underlying source is shared; intentional variant differences are identity/launcher, Dev chat origin labeling and Metro dependence. Both still hide the uncensored catalog. Release version 0.5.6/code 20 is intended as an in-place signed update; native A54 acceptance remains pending even after package verification.

Standalone 0.5.6/code 20 built and artifact-verified: 61 application sources match the current checkout, signer matches 0.5.5, embedded Hermes/features and native modules verified. Size ~63.2 MB. A54 installation and native runtime checks remain pending.

### Theme refinement rationale

The six-color selection removes White and Sage blue and adds Violet. `restoreThemeAccent` maps retired `sage-blue` to `light-blue` and `white` to `teal` during hydration; other unknown IDs retain the default fallback. Palettes remain static semantic tokens without new native/gradient dependencies. Light/dark contrast regression checks cover all six options. References reviewed 2026-11-06: [Messenger personalization](https://about.fb.com/news/2020/10/a-new-look-for-messenger/), [Instagram themes](https://about.fb.com/news/2024/03/instagram-dm-updates/), [WhatsApp themes](https://blog.whatsapp.com/chat-themes-to-reflect-your-style). These sources establish personalization patterns, not a popularity ranking of exact colors.

Standalone 0.5.7/code 21 includes the six-color refinement; build and update-signature verification passed. Native A54 acceptance remains pending.

Contact synchronization supersedes the older native email-app flow described in website rollout history. Provider inbox routing is managed in Formspree, so changing a recipient requires no client-side email credential. Existing website code/deployment is not modified by this mobile change.

Standalone 0.5.8/code 22 includes the direct contact form; 164 automated assertions, TypeScript and package/update-signature verification passed. No real feedback was submitted during testing; A54 contact delivery acceptance is pending.

### Conversation titles, previews and editing

`conversationTitle` derives display/persisted titles from the first user turn (or attached filename), runs `plainChatPreview`, normalizes whitespace and truncates by Unicode code points at 48 characters. History hydration replaces legacy UUID titles while retaining IDs and timestamps. New sends save readable titles and last-used model ID; original message content and context remain intact. `plainChatPreview` is a conservative dependency-free formatter for list/title display, preserving code/literal symbols rather than blindly deleting all asterisks. Raw transcript content remains searchable and exportable. Search can therefore match a hidden Markdown marker without a corresponding visible highlight.

ChatsScreen owns Edit/selected IDs and confirmation/deleting phases. Rows become checkboxes in Edit; normal rows only open conversations. Select all is scoped to displayed matches, and query changes clear selection. Native Alert/browser confirmation precedes any removal. Repeated confirmation/taps are guarded. The existing durable per-chat removal path runs sequentially; partial success is preserved, and failure leaves remaining selected chats available for retry. Export stays a separate action. In-memory per-conversation draft/attachment maps preserve drafts across saved-chat selection; deletion removes the associated draft. These are not persistent drafts across app restarts.

### Short web-routing decision

Ambiguous queries use a deterministic-temperature, reasoning-off local completion capped at 16 output tokens, asking only YES or NO rather than JSON-schema output. `parseSearchDecision` reads a leading decision (optionally with a short explanation/label), ignores complete thinking blocks and rejects ambiguous YES/NO combinations. Malformed output or routing-only native failure returns false and proceeds with the ordinary local reply; cancellation/GenerationStoppedError still propagates. Explicit web/no-web requests and obvious changing-fact rules retain priority before the routing pass. No extra network retry or paid search occurs for an unparseable result. Web state styling uses semantic primary/onPrimary when enabled and neutral surface/secondary when off.

Standalone 0.5.9/code 23 includes the navigation/editing/preview/web fixes. Build and update-signature verification passed against 0.5.8; 180 automated assertions and TypeScript passed. Native A54 acceptance is pending. The earlier 0.5.8 repository sync was explicitly pushed to GitHub at 7d3794e; the owner authorized publishing the 0.5.9 feature set on 2026-11-07. Native A54 acceptance remains a separate check.

Chat-list timestamp refinement (2026-11-07): display only the conversation start time on each row, without a second date label. Keep full creation date/time in stored metadata, export and accessibility labels. Ordering still uses creation time; new messages do not change the displayed start time.
