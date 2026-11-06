# PhoneGPT — Product requirements

Owner: Parth Verma. Last updated: 2026-11-06.
Status: living product specification for the Android MVP. Implementation details belong in [Technical design](TECHNICAL_DESIGN.md); delivery status belongs in [Project tracker](../PROJECT_TRACKER.md).

## 1. Purpose

PhoneGPT lets everyday users download a compatible AI model, chat with it on their phone, and dictate messages locally. After the app and models are installed, everyday chat and voice typing should work without an inference server, account or ongoing internet connection.

The product combines private on-device conversations, user choice among enabled standard models and a simple mobile experience; community uncensored/abliterated entries remain disabled behind a rollout flag. It should feel approachable to someone who does not know what GGUF, quantization or an inference runtime means.

## 2. Users and main use cases

- People who want to ask questions, write, brainstorm or discuss a local text file privately.
- People who want an assistant available while travelling or without reliable connectivity.
- People who want to choose among downloadable models and experiment with model behavior.
- People who prefer speaking into the message box, then reviewing and editing before sending.

Samsung A54 is the current Android physical test target. The same feature set is the iOS target: shared UI/chat plus iOS recorder and background-download source are now present, with a generated iOS 16.4+ project. No iOS native compilation, signed installation or physical iPhone verification has completed. Android is the only platform with produced installable artifacts; full iOS parity is not yet established.

## 3. Product principles

1. **Local by default:** inference, speech transcription and conversation storage happen on the device; no mandatory account or chat backend.
2. **User control:** users choose/download/load/delete models, stop generation, pause or cancel downloads, and delete their conversations.
3. **Simple presentation:** clean light/dark themes with a subtle teal accent, clear icons, accessible controls and readable message formatting.
4. **Honest capabilities:** distinguish a downloaded model from a loaded model, model-family capabilities from implemented app support, and storage size from memory requirements.
5. **Small initial installation:** download model weights separately; do not bundle every model into the app.
6. **Preserve work:** retain conversations, attachments and drafts during supported actions and compatible updates.

Privacy is a product goal, not a claim of end-to-end encryption or a guarantee that no platform backup exists. Android backup behavior must be resolved before store-facing privacy claims are finalized.

## 4. MVP scope and requirements

### Home and navigation

- Open on a welcome page explaining on-device use and privacy, with entry points to Chat and Models.
- Keep Home as the welcome/opening page, with future account/payment scope deferred. Bottom tabs provide Home, Chats, Models and Settings.
- Chats shows a full, virtualized conversation list with last-message previews, creation date/time, inline search, Export, Edit and a prominent filled New chat action.
- App Info and Contact are reached from Settings. Individual conversations hide the bottom tabs to preserve composer space.
- Android Back closes an open overlay first, returns a conversation to Chats, App Info to Settings, other main tabs to Home, then permits normal exit from Home.
- Use the supplied PhoneGPT logo consistently in the launcher, splash and relevant screens.

### Model discovery and management

- Offer a bundled, offline-readable catalog grouped by model family: currently Qwen, LLaMA, SmolLM, DeepSeek and Gemma.
- Show an editorial **Preferred** badge beside Qwen 3.5 0.8B in Qwen → Censored; this is a recommendation, not a measured popularity ranking or loaded status.
- Start family/model accordions closed. Show Censored and/or Uncensored subgroups only when they contain entries.
- Explain supported input/output, download size and relevant availability/errors without suggesting unsupported image inference works.
- Support download, progress, Pause, Resume, explicit X cancellation, load and delete. Show “No internet” beside an affected transfer; distinguish it from a manual pause.
- Continue new Android transfers independently of the currently selected card or screen. Restore tracked transfers after reopening where Android permits.
- Do not promise downloads survive uninstall, Force stop or every system interruption. Retain resumable state for supported recovery.
- In Chat, the model dropdown lists downloaded chat models only. Changing the loaded model preserves the current conversation.
- Show a loaded/selected indicator only when the runtime is ready. Offer loading the last successfully loaded model after a restart; do not silently download it.

Catalog labels follow model publishers' descriptions. Uncensored/abliterated is not a guarantee about every answer, model quality or compatibility. A model being listed does not mean it has passed inference testing on every supported phone.

### Chat and conversation memory

- Show a readable first-user-message title in the chat header and the loaded model below it. UUIDs remain internal storage/export identities. Titles normalize Markdown/whitespace and truncate safely at 48 Unicode characters; attachment-only chats use the file name.
- Preserve sent messages and generated replies locally. Reopening a conversation restores its transcript.
- Supply the current conversation's messages on subsequent turns. Other chats are not used as memory; there is no cross-chat personal memory feature.
- Stream output into the conversation as tokens arrive. Display inline generation feedback rather than a blocking loading screen.
- Allow typing the next draft during generation, while preventing a second concurrent send.
- Provide Stop; preserve available partial output and the next draft.
- Follow new messages automatically, including the user's sent message. Stop forcing the view down when the user scrolls up to read.
- Keep the composer above the keyboard and inside system safe areas. Support focus recovery after replies; verify behavior on real devices.
- Support selectable text, bold, headings, inline code, numbered lists and bullets. Display model-emitted reasoning rather than trying to hide it.
- The top-right + starts a fresh chat only when the current chat already has messages. An empty chat retains its UUID, draft and attachment.

“Memory” is bounded by the selected context window. The app must explain when an input no longer fits; saving a transcript does not make model context unlimited.

### History, search and deletion

- Label history entries using a first-message preview and the conversation's start date/time. Dev-origin chats carry a Dev prefix.
- Inline search on the Chats screen filters the whole history, with highlighted matching excerpts. No drawer or search-modal transition is required.
- Match literal, case-insensitive substrings anywhere in titles/messages, highlight excerpts and order results by conversation start time, newest first.
- Open a result in its original conversation.
- Do not place trash buttons on ordinary chat rows. Edit enables checkbox selection, Select all/Deselect all and a confirmed Delete selected action. When searching, Select all applies only to matching results and changing the query clears selection. Sequential deletion preserves completed removals if another fails; report the error and retain remaining selection. Delete only chosen conversations and private attachment copies; preserve source documents, other chats and models.

### Text-file questions

- The paperclip accepts UTF-8 `.txt` files up to 32 KB. Permit a question with the file, or sending the file alone.
- Preserve the original file privately and read its contents when preparing model input. Identify the file and delimit its contents for the model.
- Show the file attachment to the user without exposing expanded prompt/parsing details as chat messages.
- Report empty, invalid, missing or oversized files and inputs that exceed context.
- Images, PDFs, DOCX, scanned-document OCR and general document parsing are outside the current MVP implementation.

### Voice typing

- Models includes a Voice section with four downloadable English Whisper variants: Tiny, Base, Small Q5_1 and Small.
- Select the voice model independently of the chat model and identify it near the composer.
- Mic starts local live transcription. Show recording state and a sound meter driven by actual incoming audio.
- Insert transcription into the editable message box, appending to existing text with spacing. Do not send it automatically.
- Stop processes remaining captured audio; Cancel discards pending transcription. Handle navigation/background cancellation and remove temporary audio.
- No visible interval counter or fixed 120-second duration cap. Current Dev schedules ready audio immediately after each decode, with a 200 ms readiness retry only when insufficient fresh audio exists. A minimum 300 ms audio chunk and model/device compute time still apply. Blank/silence markers are not inserted into the draft; standalone 0.5.5 retains the older scheduler until rebuilt.
- English is the only enabled language. Spoken replies/text-to-speech are future work.

### Settings

- Save light/dark mode, app-wide text-size presets (0.5×, 0.8×, 1×, 1.2×, 1.5×; default 0.8×) and generation preferences locally.
- Save an optional System Prompt; snapshot it when a new conversation first sends a message and reuse that snapshot for the conversation. Existing chats keep their original prompt.
- Offer reasoning requests Off/Short/Extended, with behavior dependent on the model/template.
- Show current-chat context usage; explain that the visible counter excludes the hidden system prompt/template overhead.
- **Current 0.5.1 build:** reply presets 384/512/768, slider and custom integer input, starting at 384. Context starts at 1,024 with presets, slider and custom input extending to the model-reported context ceiling. Defaults remain 384 reply / 2,048 context.
- Presets are shortcuts, not maximum values. Larger reply settings require a sufficiently large active context; prompt/history also occupy that window. Context changes reload the model after committing the change, not during every slider movement.
- Reject invalid custom values and explain the allowed range. A supported model context does not guarantee the phone has enough RAM to allocate it.

### App Info and contact

- Show relevant version, local processing, storage/removal, offline, supported-input and model-reliability information, with a short creator credit; no employer or detailed biography.
- Provide required name, reply-email and message fields with a Send message action. Submit directly through the same Formspree endpoint as the website; do not expose an inbox address or open an email app. There is no app-imposed message-length cap or counter. Explain that only entered contact fields are sent online; chats are not included. Preserve the draft on failure and prevent duplicate submissions while pending. Success acknowledges provider acceptance, not confirmed inbox delivery.
- Do not imply automatic delivery. PhoneGPT does not persist the contact form in chat storage; the chosen email app may save a draft. This support form is separate from the still-missing in-app AI-content reporting requirement.

## 5. Delivery status

**Android built 0.5.3, version code 17:** standalone and Dev APKs use the current shared feature source, including live English transcription, microphone meter, logo/theme, chat/voice model management, download recovery, Stop, history search/deletion, empty-chat reuse and flexible token/context controls. Standalone embeds code; Dev uses Metro. Their data remains separate.

**iOS 0.5.3 source prepared, not built:** generated native project, local recorder/download implementations, separate Dev/standalone configuration and cloud build profiles are present. Shared tests, iOS autolinking/source checks and a production JS export pass. Swift/CocoaPods/Xcode compilation, signing and iPhone behavior remain unverified. The current owner has an iPhone only; the planned install route is a cloud macOS build plus TestFlight after Expo/Apple developer setup. An Android APK cannot be installed on an iPhone. See the [iOS build/device checklist](IOS_BUILD_AND_TEST.md).

The iOS target preserves the existing product features without introducing a backend/account requirement for chat. Apple signing/distribution requirements are separate from a PhoneGPT account. OS-controlled background execution and device RAM mean identical user-facing features cannot imply identical lifecycle/performance guarantees. Do not promise downloads continue after iOS user force-quit. Google Drive backup remains a proposal on both platforms.

Implementation and automated/browser checks are not physical acceptance. A54 inference, keyboard, audio, download lifecycle, update data retention and offline cold-start checks remain in the [device checklist](A54_TEST_CHECKLIST.md).

The 0.5.3 Dev and standalone APKs include the minimal About/contact form and Preferred badge. Artifact verification is tracked in [0.5.3 release notes](RELEASE_0.5.3.md). **Store submission remains blocked** by the [readiness gates](PLAY_STORE_READINESS.md); iOS launch remains To-do.

## 6. MVP acceptance and release readiness

- A user can install standalone, download/load a model and complete a multi-turn chat, then cold-start and use already downloaded models without internet or a server prompt.
- A short fact supplied in one turn can be recalled in the same chat; a fresh chat does not receive the previous chat's transcript.
- History survives reopening and a compatible signed update; search opens the correct chat and confirmed deletion persists.
- Sending, typing during streaming, Stop, scrolling, system bars and the Samsung keyboard work without hiding essential controls.
- Download pause/offline/resume/cancel and reopening do not create duplicate transfers or falsely report incomplete files as installed.
- Voice typing appends editable text and behaves correctly for Stop, Cancel, permissions and navigation; temporary recordings are cleaned up.
- Both themes and supported font sizes remain usable. Model errors and memory/load failures provide recovery actions.
- Complete the store release checklist, privacy/backup decisions, model-license review, upload signing, permissions and applicable testing before submission. Successful APK compilation is not Play Store readiness.

No remote analytics or onboarding database is required for MVP measurement. Use local verification and explicit user feedback for this phase.

## 7. Future scope

Keep these in the tracker rather than implying they are available: image chat with matching vision projectors, additional document parsing/OCR, spoken replies/more languages, shared Dev/production storage, verified iOS native delivery, optional email/password accounts and any later user-selected cloud features. Authentication/MongoDB is a proposal only; chats are not uploaded.

Store-size optimization, broader device testing and UI refinement are near-term release work. No subscription, monetization or automatic update service is specified by this document.

### Proposed optional cloud backup — not implemented

[Google Drive backup/restore proposal](GOOGLE_DRIVE_BACKUP_PLAN.md) places Link Google Drive, Store to Drive and Import from Drive in Settings → Backup & restore → Google Drive backup, with automatic backup and Disconnect controls. Store/Import stay disabled until connected; import opens a preview before merging. No PhoneGPT account is required. Backups would travel directly from the phone to the user's authorized Drive folder, containing conversations, original timestamps, prompt snapshots and attached TXT files; model weights and raw voice recordings are excluded. Opted-in users must be told that these copies leave their device.

Recommended first version: immutable conversation revisions plus explicit restore/merge, preserving duplicates/conflicts safely rather than blindly replacing newer chats. Local deletion would keep backups by default; cloud deletion is separate. Proposed automatic timing defaults to approximately hourly batches, subject to network/Android scheduling. Store to Drive immediately requests the same durable queue; scan all saved chats but upload only missing/changed revisions. Conversation/message IDs stay stable. Timestamps support display/filtering, while revision ancestry and logical-content checks prevent unsafe replacements. Repeated imports and manual requests must be idempotent; concurrent branches are preserved. Offline backups are eventually consistent, not a guarantee of instantaneous or 100% cloud consistency. Encrypted archives and portable recovery material are proposed, not yet selected/implemented.

For discovery, once the feature is ready and permitted, add a dismissible Home card below the main Chat/Models actions with Connect Google Drive and Not now. It opens backup settings/consent; it never blocks local chat or begins uploads on its own. Persist dismissal and show connected users a compact backup-status link. The full Link/Store/Import controls remain in Settings. Until readiness, keep the promotion unavailable in normal production builds and use fixtures only for UI development.

The [multi-agent execution plan](GOOGLE_DRIVE_IMPLEMENTATION_PLAN.md) sequences shared contracts, parallel local UI/archive/repository work, independent failure/UX review, gated manual Drive integration and then automatic scheduling. Three planning reviews completed; no backup implementation was added. The durable repository/outbox is required before manual as well as scheduled Drive uploads.

This is outside the shipped MVP. Google's current Drive terms/policy restrict this app-content backup use case; written clearance is required before enabling it. The proposal records the official references, architecture, failure/deletion/account scenarios and phased acceptance tests. No authorization flow or uploads have been added.

## 8. Maintaining this document

Update this PRD in the same change when product scope, user-visible behavior, supported inputs/models/platforms, defaults, privacy promises or acceptance requirements change. Record shipped versus Dev-preview status explicitly. Link implementation decisions to the technical design and tasks to the tracker; avoid using the tracker as the product specification.

## Public product website

A separate `phone-gpt-website` repository introduces what PhoneGPT is, why local AI is useful, who it suits, current features and setup. Ten pages cover Home, Features, Models, Get started, Downloads, FAQ, Privacy, Contact, About and What’s new. The homepage ends with Say hello: feedback, well wishes, ideas and model requests; it is not the proposed in-app AI-content reporting service. The website’s form opens an email draft for user review/sending, with no site form backend or message database. Model search/filtering is a website catalog interaction, not browser inference or installation.

Android beta APK distribution is provided through a GitHub release linked from the download page once publication completes. Google Play and iOS are explicitly unavailable. Device/model memory limits and setup connectivity are explained; screenshots/illustrative interface content must be labeled accurately. Site publishing evidence is maintained in the website README/review notes; it does not establish store readiness.

Website copy uses everyday product language, without internal build/source/signing details. Public attribution reads “Parth Verma — Curious mind. Problem solver.”; no founder/developer title or printed inbox address. Contact enquiries link to the Say hello form. LinkedIn and an explicitly labelled project-contribution GitHub link are available. The website form’s requested inbox is configured separately from the mobile app.

Website navigation now uses homepage section links for Home, Features, Models, Get started, FAQ and Downloads; all core discovery/download tasks are available there, with an expandable model library and the complete FAQ. Detail pages stay available with an explicit Back to Home link. Spacing and centered content panels were refined. The homepage phone visual is a sample conversation; the visible illustration caption and offline badge were removed at the owner’s request without calling it an actual app screenshot.

Website model discovery now uses the same light surface and restrained teal accents as surrounding sections. Direct form delivery without opening an email app is requested; connection to a verified form-service endpoint is pending, so the live contact behavior remains an explicit email draft for now.

Website contact update (November 4): the owner supplied a Formspree endpoint. Website messages now submit directly without an email app; loading, duplicate-click prevention, success confirmation and draft-preserving error/timeout handling are provided. Formspree processing/retention is disclosed in website privacy. Native app contact behavior is unchanged. No chats are uploaded.

Cloudflare Pages website: additional public static hosting at https://phone-gpt.pages.dev/. Existing GitHub Pages hosting, GitHub Release APK download and direct Formspree contact submission remain supported. First Cloudflare publication uses a static upload; future GitHub pushes do not automatically update that deployment. Live verification is recorded in the website repository.

Hosting update November 4, 2026: Cloudflare Pages (https://phone-gpt.pages.dev/) is the production website. Old GitHub Pages hosting is disabled; website source repository and APK Release assets remain public by owner request.

Website deployment automation (November 5, 2026): pushes to website repository `main` build and validate the static export, then publish to the existing https://phone-gpt.pages.dev/ address through GitHub Actions/Wrangler. Deployment credentials reside in encrypted repository Actions Secrets, not website source/build output. Pages Write permission is scoped to the Cloudflare account. Initial automated deployment verification is tracked in the website verification document.

Automatic website deployment verified November 5: first push-triggered GitHub Actions run 41999464002 succeeded, including Cloudflare publishing. Changes to website `main` now update the existing production URL after checks pass.

Website visual alignment (November 5): model discovery, setup and contact share bounded panels with consistent pale green tint, corner radius and responsive page gutters. Very narrow headers omit the secondary download CTA to prevent crowding. Mobile app UI is unchanged.

Android delivery: verified standalone 0.5.9 / code 23 contains current shared product features including optional web search. Existing Dev 0.5.4 receives 0.5.9 JavaScript through Metro. Installation/export/native inference still require A54 acceptance.

## Planned model memory/device guidance

Models should separately show download storage, estimated runtime RAM for the selected context and device-tested suitability, with clear unknown/estimated/measured labels. Research and A54 measurements precede fixed minimum-device claims. Include combined chat/voice memory; do not confuse free storage with available RAM. This remains To-do, not shipped behavior. See [research](MODEL_MEMORY_RESEARCH.md). Other first-visitor review recommendations are deferred by owner choice.

## Optional web information — Dev preview

Optional Web mode is implemented in source for Dev testing, behind a build-time flag and a compact Web switch beside the model selector under the chat UUID. Questions needing current information can retrieve up to three sources in one online search per turn. Definitions stay local; ambiguous questions use a local routing decision. Only the current question is sent for search, not the full conversation or attachments. The answer is generated on the phone, with expandable source links and retrieval timestamps. Search defaults on for new Dev preferences; an explicit saved off setting is preserved. Explicit per-message web requests trigger search, including definitions requested with web verification; explicit no-search requests stay local. Current/historical officeholders and prices favor search. Production rollout remains pending. The Dev proxy and its server-side Brave key are configured; one live query returned three sources with HTTP 200. A54 validation remains pending. Offline local chat remains available with Web off. Search snippets are evidence, not a guaranteed authoritative live-data feed. See [plan](WEB_SEARCH_PLAN.md).


### Web search feedback and context display

Dev shows an app-owned “Searching the web…” overlay over the message area while retrieval and evidence preparation run; it disappears for local answer generation and does not block typing or Stop. Grounded answers have a “From the web” label and expandable sources. The prompt asks for direct answers without a routine trailing internet disclaimer, while retaining specific uncertainty when the evidence is missing, stale or conflicting.

The current/last web-turn tracker includes the hidden prompt, search input and generated reply. Streaming output is estimated, then the completed output is tokenized. Saved usage is scoped to that conversation's latest reply, model and context size; a new turn/model/window uses its own count. An empty chat remains empty. These changes are Dev source, pending device verification. Cloudflare service monitoring is aggregate; there is no signed-in user tracking or conversation/query logging service.

The compact Web on/off control sits next to the model selector below the conversation title. Its online-query/local-reply explanation appears once when an enabled Web mode is first opened on Chat (including the default-on case), then remains dismissed across relaunches and toggle cycles. Clearing app data resets that notice. The composer has no recurring search explanation.

## Local conversation export — Dev source

An Export icon beside Search in Chat History opens an export screen. A single All chats toggle starts selected; tapping it clears every selection so users can choose individual chats. Tapping it again selects every chat. Individual checkboxes also update its selected state. Export creates a single ZIP containing readable UTF-8 transcripts and structured JSON per conversation, named by UUID, plus available original attached text files. Metadata includes conversation/message identity, available timestamps, custom prompt, source citations and context-usage records. Exports do not change or delete the local chats. Missing attachments are reported in the archive and completion message.

Android asks the user to choose/create a destination folder and saves there; cancelling leaves no export. The web preview starts a browser download. Archives contain private content and are unencrypted. This is an export, not an implemented restore/import or cloud backup. iOS export is deferred with iOS launch. Very large histories can be selected and exported in batches. No account/network upload is required. Implemented in shared source and Dev; no updated production APK claimed shipped.

### Shared control styling

Model selection and Web use the same compact surface, corner radius, height, font weight and spacing; Web's accent indicates its state. Shared action buttons, New chat, history actions and settings presets follow the same sizing and pressed/disabled conventions, with primary/danger actions differentiated by color. The default font scale remains 0.8× and touch targets remain at least 44 points.

Android export currently requires a selectable destination subfolder, for example Downloads/PhoneGPT, and explains this on the export screen. Android-protected root folders cannot be selected in the current folder-access picker.

### Uncensored catalog rollout disabled

`UNCENSORED_MODELS_ENABLED` is false in shared Dev/production source. The central model list filters uncensored entries before provider grouping, downloaded-model selection and last-loaded restoration. Empty families/sections are omitted; catalog metadata is retained for a future explicit rollout. A Fast Refresh selection that becomes hidden is reset and unloaded. No model files or conversations are deleted. This is a visibility rollout decision, not a Play Store approval certification. Dev updates on reload; existing standalone APKs need rebuilding to include it.

### Applying generation limits

Maximum reply length and Conversation context share one editing flow: the current draft number appears once in the numeric field. Slider movement, preset taps and typed edits update that draft. Apply is solid teal for a valid pending change and subdued/disabled once the value is applied or unchanged. Only Apply commits the setting; context reload occurs on commit, not on every drag or preset tap. Invalid numbers cannot be applied and range guidance remains visible.

Standalone 0.5.5 / code 19 has now been built and verified with the local export, shared controls, 0.8× default font size, explicit token Apply flow and hidden uncensored catalog. Web search remains gated off in production. Physical device verification is pending.

### Post-0.5.5 Dev follow-up: natural web answers and scroll intent

Web-grounded replies should answer directly with brief relevant background, without explaining which numbered link supports each claim. The app keeps the source list below the answer rather than requiring source narration in the body. Specific missing/conflicting evidence still needs honest handling.

Touching/scrolling up pauses chat following, including small upward moves near the bottom and wheel/accessibility scrolls that lack native drag events. Content updates, keyboard/layout changes and queued post-Send frames must not override a newer reading gesture. Following resumes when the user scrolls down to the bottom or explicitly sends a new message. These are subsequent source/Dev fixes; the already built standalone 0.5.5 APK does not contain them.

### Post-0.5.5 Dev voice follow-up

Live and recorded transcription filter known non-speech/control markers such as `[BLANK_AUDIO]` before draft callbacks, preserving real speech around those markers. Existing typed content and session/cancellation isolation remain intact. Ready audio does not wait for a fixed one-/two-second transcription tick; no overlapping or duplicate decodes are scheduled. This improves scheduling latency, not a promise of immediate recognition independent of audio buffering or phone speed.

### Expanded compact-model catalog (source/Dev)

The standard catalog now includes Qwen 3.5 2B, Gemma 3 1B Instruct and DeepSeek R1 Distill Qwen 1.5B. Downloads are approximately 1.28 GB, 0.81 GB and 1.12 GB respectively, separate from runtime RAM requirements. These are original instruction/reasoning releases with community GGUF conversions, not the hidden uncensored variants. DeepSeek's entry is an official DeepSeek distillation of a Qwen base. Qwen's advertised 2B tier includes a larger complete multimodal checkpoint; Gemma 4 E2B is also not a <=2B-total model and remains a separate existing option. Current app support is text chat; upstream multimodal capability does not enable image chat automatically. New entries are available on Dev reload, with physical-device inference verification pending; the previously built standalone 0.5.5 does not include them.

Conversation context offers 2,048, 4,096, 10,000, 20,000 and 32,768 quick choices within range, plus a slider/custom integer. Default remains 2,048. Unknown model capacity no longer restricts editing to 4,096: it permits requests up to 32,768 with unverified-support guidance. Known GGUF limits remain enforced; larger allocations can fail on limited phone memory. Source/Dev only until the next standalone build.

### Theme colors and Dev/production feature parity

Settings → Appearance offers Teal (default), Light blue, Royal blue, Violet, Red and Pink. A selected color applies immediately to shared controls, selections and chat bubbles and survives restart. Light/dark mode remains a separate preference, with contrasting text in each palette. Existing appearance/font choices are preserved. No account or cloud storage is involved.

Version 0.5.6 brings production into sync with current Dev product behavior, including optional web search, expanded compact-model catalog, 10,000/20,000 context choices, ready-audio transcription, marker cleanup, manual scroll priority, natural web-answer presentation and exports. Search remains optional and network-based, with its existing one-time disclosure and proxy quotas; local chat and voice do not require it. Uncensored models remain hidden in both variants. Dev retains its launcher/name/package and server requirement; production embeds its code for offline startup. Build/artifact verification and device acceptance are separate release steps.

Standalone 0.5.6/code 20 built and artifact-verified: 61 application sources match the current checkout, signer matches 0.5.5, embedded Hermes/features and native modules verified. Size ~63.2 MB. A54 installation and native runtime checks remain pending.

### Refined theme choices

White and Sage blue are removed from the theme picker. Violet joins the retained Teal, Light blue, Royal blue, Red and Pink choices, preserving a small selection with readable light/dark variants. These are design choices inspired by messaging-app personalization, not measured rankings of user color preferences. Existing retired choices migrate gracefully without touching conversations, models or light/dark mode.

Standalone 0.5.7/code 21 includes the six-color refinement; build and update-signature verification passed. Native A54 acceptance remains pending.

### Direct contact form

App Info → Contact now uses the owner-provided website form endpoint. Only tapping Send message transmits the entered name, email and message through Formspree. Chat history, attachments and model data are excluded. No email inbox is displayed or embedded in the app. The message is required but has no application maximum length; name/email validation remains. Provider/network limits can still reject submissions, preserving the draft and showing a retry notice. The contact form needs internet; this does not change offline inference.

Standalone 0.5.8/code 22 includes the direct contact form; 164 automated assertions, TypeScript and package/update-signature verification passed. No real feedback was submitted during testing; A54 contact delivery acceptance is pending.

### Navigation and routing refinement — 0.5.9

Home remains the opening page by owner choice. Chats is a separate bottom tab with familiar list navigation, first-message titles, last-message previews, retained start dates, inline full-history search and Edit-based deletion. Model switching, context controls, exports, voice and local conversation memory remain available. Unsent drafts are retained in memory when switching saved conversations; they are not newly backed up or synced. Preview formatting removes common Markdown decoration without changing original messages. New chat is visibly filled in the chosen theme; repeated New chat on an empty conversation still reuses it.

Web on uses a filled accent surface with contrasting label/icon; off uses a neutral surface. Ambiguous auto-routing makes a brief YES/NO local decision. An unusable decision or routing-only failure falls back to a normal local reply instead of failing the conversation; explicit requested searches and deterministic changing-fact checks still bypass that decision. A fallback is not evidence that the answer has been verified online. Authentication, payments and cloud history remain deferred.

Standalone 0.5.9/code 23 includes the navigation/editing/preview/web fixes. Build and update-signature verification passed against 0.5.8; 180 automated assertions and TypeScript passed. Native A54 acceptance is pending. The earlier 0.5.8 repository sync was explicitly pushed to GitHub at 7d3794e; the owner authorized publishing the 0.5.9 feature set on 2026-11-07. Native A54 acceptance remains a separate check.

Chat-list timestamp refinement (2026-11-07): display only the conversation start time on each row, without a second date label. Keep full creation date/time in stored metadata, export and accessibility labels. Ordering still uses creation time; new messages do not change the displayed start time.
