# Proposed GitHub issues

Drafts for review only; no GitHub issues have been created. Device acceptance refers to the current standalone release, 0.5.14/code 28. Existing automated or artifact checks do not establish physical-device results.

## Current To-do

1. **Verify the standalone update, navigation and chat on A54**  
   Exercise the installed app, including chat interactions and presentation.  
   **Acceptance:** Install over the existing app and check retained data, version, offline cold launch and local chat without Metro; verify navigation/back, search, deletion/recovery, drafts, streaming/Stop, scrolling, keyboard, themes, text sizes and accessibility.

2. **Validate models, generation controls and saved prompts on A54**  
   Check model inference and configuration with the shipped UI.  
   **Acceptance:** Exercise catalog downloads/loads including the newer Qwen, Gemma and DeepSeek entries, recall, Stop and cleanup; check Preferred badge, sliders/custom values, Apply/reload and context limits. Verify prompt history, restore, unsaved edits, large text, default/custom/blank persistence and existing chat snapshots.

3. **Research and measure model memory requirements**  
   Develop useful, evidence-labelled device guidance for all catalog entries.  
   **Acceptance:** Identify exact quantizations; distinguish storage from runtime RAM, include context/cache and concurrent voice memory, measure standalone peaks on A54 starting with Qwen 3.5 0.8B and Whisper Tiny/Base, and present estimates with sources and explicit unknowns. See [research](MODEL_MEMORY_RESEARCH.md).

4. **Verify download recovery and connectivity on A54**  
   Exercise chat and voice model transfers across lifecycle and network changes.  
   **Acceptance:** Check pause/resume, offline status, retry, cancellation, reopening and background recovery without duplicate tasks; verify error/load labels and offline local inference.

5. **Verify voice transcription and lifecycle on A54**  
   Assess the live scheduler and preserved recording mode with real audio.  
   **Acceptance:** Test available models including Tiny/Base, permissions, speech/silence/noise, corrections, long recordings, draft edits, Stop/Cancel, chat switches, background cleanup and offline use; record latency, CPU and memory observations.

6. **Verify shipped web search on A54**  
   Exercise routing, search UI, grounded answers and quota handling.  
   **Acceptance:** Check explicit search/no-search, definitions, officeholders and prices; Web toggle/explanation persistence, stages, Stop/typing, sources/links, context usage, limits and local fallback, including long model names and scrolling.

7. **Verify export and direct contact on A54**  
   Check local archive creation and the Formspree contact flow.  
   **Acceptance:** Verify selection, destination, ZIP contents/attachments, cancellation and missing-file feedback; check contact validation, keyboard, long text and offline/failure draft retention. If the user chooses an intentional submission, check actual inbox delivery separately from provider acknowledgement.

8. **Complete Android store preparation and size audit**  
   Close the outstanding [readiness](PLAY_STORE_READINESS.md) and [size](APP_SIZE_PLAN.md) work before submission.  
   **Acceptance:** Address AI safeguards/reporting and delivery, review of the published privacy policy and backup decision, permissions, licensing, Play App Signing enrollment/upload and split testing (local signed AAB prepared), target API and 16 KB requirements, listing/declarations and applicable device/closed testing; measure Play download size and evaluate shrinking, unused picker and engine variants without breaking inference.

9. **Build, test and prepare iOS delivery**  
   Compile and sign the prepared native project and verify it on iPhone.  
   **Acceptance:** Set up Apple/Expo signing, resolve build/runtime findings, test inference, pickers, downloads, voice, permissions and memory against the [checklist](IOS_BUILD_AND_TEST.md), then prepare TestFlight and Apple privacy/listing/review requirements.

## Backlog

10. **Design and implement optional Google Drive backup and restore**  
    Stage portable encrypted archives/manual restore before direct Drive integration; provider clearance is a prerequisite.  
    **Acceptance:** After clearance, support explicit authorization and user-controlled operations, durable queued retries, immutable revisions, idempotent conflict-safe restore and account/deletion isolation; document approximate scheduling and test failure/recovery scenarios. See [plan](GOOGLE_DRIVE_BACKUP_PLAN.md).

11. **Add optional identity-only email/password accounts**  
    After the initial release, provide voluntary sign-in using a separate service and Dev/Prod databases.  
    **Acceptance:** Implement account creation/sign-in and identity storage without uploading chats or preferences; keep local use available without an account. Google sign-in remains deferred. See [plan](AUTHENTICATION_PLAN.md).

12. **Explore shared storage between Dev and production**  
    Design a signature-protected bridge for app data currently isolated by variant.  
    **Acceptance:** Define and validate access, migration and failure behavior for chats, attachments and models; implement compatible native changes in both variants if feasible.

13. **Add local image chat and private image storage**  
    Support compatible vision models with their matching projectors.  
    **Acceptance:** Download/load compatible projectors, run local image-plus-text inference, display images in messages/history, and store and clean up private per-chat originals on deletion.

14. **Support additional document formats**  
    Extend local attachment handling to PDF, DOCX and other selected formats.  
    **Acceptance:** Parse supported documents locally, provide useful errors and context-aware chunking for large files, and decide/document OCR support for scans.

15. **Expand voice capabilities**  
    Explore spoken responses, additional speech models and language selection.  
    **Acceptance:** Define supported models/languages and implement selected capabilities with clear controls and local-device resource behavior.

16. **Improve the Android export destination picker**  
    Evaluate a Save As flow for ZIP exports.  
    **Acceptance:** If feasible, use `ACTION_CREATE_DOCUMENT` to save to ordinary destinations without requesting whole-folder access; handle cancellation and protected OS locations clearly.
