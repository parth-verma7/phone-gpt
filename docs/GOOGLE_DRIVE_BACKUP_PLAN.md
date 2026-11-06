# Optional Google Drive conversation backup and restore — proposal

Updated: 2026-11-01. **Planning only: no OAuth clients, credentials, dependencies, workers, uploads or app controls have been added.** Product scope: [PRD](PRODUCT_REQUIREMENTS.md). Architecture: [technical design](TECHNICAL_DESIGN.md).

## 1. Goal and feasibility gate

Let a user optionally connect their own Google Drive, back up complete conversations and restore them after local data loss or on a new phone. Core local chat remains usable without connecting. No PhoneGPT account, user database or chat-storage server is required. The mobile client talks directly to Google, so PhoneGPT avoids hosting chat data, but still owns the authorization, network/retry, quota, data integrity and support code.

**Google permission is a prerequisite, not assumed.** Checked 2026-11-01: [Drive API terms](https://developers.google.com/workspace/drive/api/terms) require Google's express prior written consent for backing up user/app content from a developer's app to Drive. The [Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy#appropriate_access_to_and_use_of_google_drive_scopes) also lists that use case as disallowed. Our interpretation is that this proposed automatic PhoneGPT backup falls within that restriction. Obtain authoritative written clarification/approval covering the actual workflow under both documents before enabling it. A narrow OAuth scope, user consent, encryption or renaming backup as sync does not establish an exception.

If Google does not permit the integration, keep the API feature disabled and consider provider-neutral local archive export/import or a different storage provider under its own terms. Do not promise that a manual Drive API upload automatically avoids the restriction.

## 2. Recommended product model

Start with **backup plus explicit restore**, rather than a live two-way mirror. Every backed-up change creates an immutable conversation snapshot. Later messages create a new revision; they never blindly replace the only saved copy. Restore merges safely into local history and preserves conflicting branches.

This protects against accidental local deletion and avoids silently spreading it to every device. Local deletion, remote-backup deletion and disconnect are distinct actions. Automatic multi-device conversation merging is deferred; the first version must detect branching and retain both versions.

### Settings → Backup & restore (proposed)

- **Link Google Drive**: explain what leaves the device, choose a Google account, authorize the minimum Drive access and choose/create the backup location. Connection does not upload anything until the user confirms backup scope and enables it or presses Store to Drive.
- **Store to Drive** (Back up now): immediately start the same durable queue used by automatic backup. Scan all eligible saved conversations, but upload only missing/changed revisions. Show progress/result; repeated presses join the existing run rather than starting duplicates.
- **Automatic backup** toggle, off initially. Default after enabling: an approximately hourly batch of dirty saved conversations. Completing/stopping a reply only marks the chat dirty; it does not force an immediate upload. Optional after-activity (~five idle minutes) or daily scheduling can be added later. Hourly scans do not re-upload unchanged conversations.
- **Import from Drive** (Restore chats): list available conversations, dates, source device and conflicting versions; preview a merge summary and confirm. Offer Restore all or selected chats. Never silently replace all local history.
- **Network preference**: Wi-Fi only by default; allow the user to permit other networks. Offline chat remains unaffected.
- Display connected account, last successful completed backup, pending chat count and actionable status: Waiting for Wi-Fi, No internet, Backing up, Reconnect Google Drive, Drive storage full or Backup failed.
- **Disconnect** stops workers and future requests, cancels in-flight work where possible, releases local authorization/account-specific state and leaves existing local chats and remote backups intact. State explicitly that an upload already accepted by Google cannot be undone merely by disconnecting.
- Separate **Manage/delete Drive backups** with explicit scope/confirmation. Distinguish current backups from old revisions and other devices' branches.

### Exact placement of the three main actions

Put a dedicated **Google Drive backup** card under **Settings → Backup & restore**, below the ordinary chat/generation preferences. Keep these actions out of the chat composer/header.

1. **Link Google Drive** is the first action when disconnected. **Store to Drive** and **Import from Drive** remain visible but disabled with “Connect Google Drive first”. Cancelling/denying authorization leaves the rest of PhoneGPT unchanged.
2. Once connected, show the selected account/folder, then **Store to Drive** as the main action and **Import from Drive** as the secondary action. Show the automatic-backup toggle/frequency (Hourly by default), network preference, last completed backup time and pending count below them.
3. Account/folder switching, Disconnect, encryption/recovery and backup deletion belong in this card's management/details area. Import opens a preview/confirmation screen with new/unchanged/newer/conflicting counts; neither linking nor browsing triggers an import.
4. During an active backup, the manual button shows progress and opens that run instead of enqueuing another full pass. Imports serialize their local merge with chat writes and recheck for newer local edits before commit. Status always distinguishes a partial batch from all eligible revisions being verified.

Cloud backup changes the privacy story: selected conversations and attachments leave the phone for the user's Google account. Disclose this before opt-in; local inference remains local. Do not continue saying all chat data stays only on-device for opted-in users.

## 3. Folder, authorization and environments

Proposed location: a visible private folder, `PhoneGPT Backups`, with versioned `production` and `development` namespaces. Do not share it publicly or use chat text as Drive filenames. Persist account identity + folder ID; names alone are not unique identities. After reinstall, allow the user to explicitly reselect the existing folder and verify access; do not assume all files with a matching name are ours.

Prefer the narrow `drive.file` scope for app-created or explicitly user-selected files, subject to a restore/reinstall prototype. Avoid full-Drive access. The hidden `appDataFolder` alternative uses `drive.appdata` but is invisible in normal Drive UI and has sharing/trash restrictions, so it is less suited to the requested user-visible special folder. Neither option overrides the policy gate. [Scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth); [app-data folder constraints](https://developers.google.com/workspace/drive/api/guides/appdata).

Android can request Drive authorization when the user invokes the feature; a PhoneGPT sign-up flow is separate and unnecessary. Use native Google Identity authorization, keep tokens out of chat JSON/logs and avoid embedding any client secret. Obtain fresh short-lived authorization through supported native APIs; if user interaction is needed while backgrounded, pause with Reconnect rather than launching an unsolicited sign-in prompt. [Android authorization guidance](https://developer.android.com/identity/authorization).

Register correct package/signing identities for Dev, local release and eventual Play signing. Dev must never silently upload into production's namespace. Cross-environment restore requires an explicit choice; cross-device restore within the same environment is intended. OAuth verification/publishing requirements and managed Google account restrictions need verification during setup. No Cloud Console setup is authorized by this planning task.

## 4. Backup contents and privacy

One immutable archive per saved conversation revision contains:

- Backup schema version, app version, environment, stable chat UUID, revision UUID, parent revision IDs and a source-installation ID (random, not a hardware identifier).
- Original conversation creation/update timestamps, message IDs/roles/content and original message timestamps where known. Add explicit message timestamps for new messages; migrate older timestamp-bearing IDs carefully and preserve unknown timestamps as unknown.
- The conversation's saved system-prompt snapshot, since it affects continuing the chat. Disclose its inclusion. Global preferences/prompts, unrelated accounts and credentials are not implicitly included.
- Attached original TXT bytes, portable attachment IDs/names/sizes and checksums. Do not put local absolute URIs into the portable format. Record model provenance when known; do not invent it for historical records that never stored it.
- A canonical payload checksum for corruption detection and version comparison. Model weights, raw voice recordings and transient unsent drafts are excluded. Dictated text already sent in a chat is ordinary message content.

Recommend client-side authenticated encryption before uploading private conversations. Proposed approach: an audited native crypto implementation, random data key and recovery passphrase/key that works across devices, with encrypted local key wrapping in Android Keystore. Exact library/KDF parameters remain a design review item; do not write custom cryptography. A device-only Keystore key is insufficient for reinstall/new-phone restore. Confirm that recovery material is saved before automatic backup begins. Lost recovery material means encrypted backups cannot be restored; an account connection alone cannot decrypt them.

If an unencrypted export is offered later, make it explicit and distinguish it from encrypted backup. File metadata (sizes, timing, opaque IDs) may remain visible to the provider even with encrypted contents. Keep chat titles/checksums inside encrypted payloads where feasible. User Drive capacity and API quota limits still apply.

## 5. Durable storage and background execution

The existing AsyncStorage whole-history JSON store has no durable native backup outbox. Do not attach a JavaScript timer to the chat screen and call that reliable background backup.

For automatic backup, propose a native-accessible transactional chat repository plus outbox (Room/SQLite on Android), migrating existing chats and retaining attachment files. Saving a completed/edited conversation and marking its revision dirty should commit together. This prevents a crash between local save and backup scheduling from permanently losing a pending update. Migration must be verified before removing the old store. Manual export/restore can be prototyped first without this migration; unattended backup needs the durable design.

Every message keeps a stable message UUID. A new committed user/assistant message or durable edit increments that conversation's device-local `localChangeSeq`, updates `updatedAt` and marks it dirty in the same transaction. Never change the conversation UUID to represent progress or generate a new message ID on export/import. The existing timestamp-style message IDs need a compatible migration/mapping; historical IDs must not be randomly regenerated on each restore.

A backup revision UUID identifies an immutable snapshot of settled saved content: a completed reply, saved partial reply after Stop/error, or another durable edit. Streaming tokens, voice-in-progress and unsent drafts must not each cause cloud writes. Defer a currently generating chat until it settles, while other chats continue. After a crash, committed user-only/partial content is still durable and can be backed up during recovery; unpersisted streamed tokens cannot be recovered. The worker snapshots a consistent revision; a chat modified during upload remains dirty for its next revision.

Use unique Android WorkManager jobs with network constraints. Default to an hourly periodic batch; Store to Drive requests a one-time run of the same worker immediately when constraints permit. Optional after-activity scheduling would use a delayed one-time task; optional daily scheduling means eligible around the selected local time, not exactly at midnight. Android periodic work has a 15-minute minimum and OS-dependent execution; no exact hourly/background timing guarantee is possible. Handle reboot, battery restrictions, task cancellation and Force stop by retaining the outbox and reconciling on next launch. [Work scheduling](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work).

Workers need direct native access to records, attachments and authorization; they must not require Metro, a mounted React component or a live JS runtime. iOS scheduling/authorization requires a separate design when native iOS delivery is implemented.

Suggested outbox data: account/namespace, chat UUID, revision UUID, parents, local snapshot path/hash, preallocated remote file ID, state, attempt count, next eligible time and last error. States: dirty → staged → uploading → verified; transient errors return to waiting/retry, authorization/quota errors wait for user action. Scope all records to the authorized account and consent session.

### Queue and bounded batching

Use a durable on-device outbox for manual and automatic Drive backup, not an in-memory queue or a server message broker. Complete the transactional repository/outbox before either live upload mode; local archive export/import can be prototyped earlier. One pending entry per account + environment + conversation coalesces successive unsent changes to the latest saved state. Keep an immutable in-flight entry separate: completing revision A must not mark later local revision B backed up. Persist captured change sequence/revision/hash, attempt state and the remote ID before network work.

Use one database-claimed logical sync runner per namespace, with a recoverable lease/fencing token, to prevent manual and scheduled jobs racing. Separate unique WorkManager names alone do not provide this mutual exclusion. Enumerate dirty/missing conversations in bounded batches (proposed 20 per pass), with one upload at a time initially. Persist the cursor and outcome after each chat; continue in follow-up work if a batch hits execution/resource limits. Backup order uses durable queue order for fairness, not conversation timestamps as a correctness rule. Manual “store everything” means all eligible conversations are checked, with unchanged records skipped; it is not an unbounded memory allocation or full re-upload.

On launch and before a run, reconcile the repository's current change sequence against each chat's verified checkpoint to repair missed scheduling. A timer/queue wake-up is only a request to run; the durable dirty state is the source of truth. Record per-chat successes/failures and distinguish last attempt, last verified revision and last fully caught-up pass. Never delete local conversations merely because a batch is incomplete.

## 6. Upload correctness and versioning

1. Stage a consistent archive/encrypted revision, persist its operation/revision ID and reserve a Drive file ID before upload. A retry must reuse that identity.
2. Upload a regular binary archive under an opaque revision filename. Drive supports pre-generated file IDs to avoid duplicate creation after ambiguous timeouts; verify the same remote object instead of allocating another on each retry. Use a resumable upload when appropriate for mobile interruptions. [Upload and retry identity](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
3. Verify the resulting remote file size/checksum and expected revision identity before marking it backed up. On restore, also verify authenticated encryption and payload checksums. Server transport checks alone do not establish valid chat contents.
4. Mark only the uploaded revision verified. If local content changed meanwhile, retain the newer pending revision. Never clear a dirty flag for content the worker did not upload.
5. Discover archives via paginated folder listings and opaque app metadata, not filenames alone. An index may speed discovery but cannot be the only copy of restore metadata. Every finalized archive is independently self-describing.

### Matching by UUID, revision and timestamp

The effective identity is account + environment + conversation UUID. Track these distinct fields:

- `chatId`: permanent conversation UUID, unchanged across devices/restores.
- `messageId`: permanent UUID for each message; edits retain it. It is not the backup checkpoint.
- `localChangeSeq`: monotonically increasing local conversation counter, useful for detecting edits while uploading; it is never globally ordered against another device's counter.
- `revisionId` / `parentRevisionIds`: portable immutable snapshot identity and causal ancestry.
- `contentHash`: canonical fingerprint of all backed-up logical chat fields, original timestamps, prompt and attachment contents. Exclude local URIs, backup-attempt times, device-specific paths and encryption nonces. Keep the hash in protected metadata where practical; encryption randomness must not make unchanged logical content look changed.
- `updatedAt`: original last durable conversation-change time, useful for display and an initial candidate comparison, not proof of ancestry.
- `lastBackedUpRevisionId` and `lastBackedUpChangeSeq`: the exact locally acknowledged checkpoint, scoped to account/folder/environment.

Read a lightweight remote inventory/validated per-revision metadata before transferring large archives. A cached index is an optimization only; recover through paginated listings if it is stale/missing. Do not trust Drive filename uniqueness or provider `modifiedTime` as the conversation's original update time. Metadata/hashes must be validated against the downloaded archive before replacing local data.

For **Import from Drive**:

1. UUID absent locally → stage/validate/import the selected valid remote head, unless locally suppressed/deleted (show it as an explicit restore choice).
2. Matching revision or equal validated logical content → skip, even if backup upload times differ.
3. Remote is a proven descendant of local → import/update, after checking no local edit occurred during download.
4. Local is a proven descendant of remote → keep local; no older content download/replacement is needed. It remains eligible for backup if not acknowledged remotely.
5. Different or equal timestamps with divergent/unknown ancestry → preserve both and show a conflict choice. A later timestamp alone must never discard the other branch. For legacy archives without revisions, full validated logical-content equality permits skipping a duplicate visible copy; message-prefix similarity alone cannot prove ancestry because prompts, attachments or metadata may differ. Uncertain lineage becomes a conflict, not an overwrite.

For **Store to Drive**:

1. Local head missing remotely → upload that revision using its retry-stable identity.
2. Same acknowledged revision/content exists → skip and reconcile the checkpoint.
3. Local head safely descends from a remote head → upload the new snapshot; retain the older revision according to the explicit retention policy.
4. Remote has newer/different content → do not overwrite or silently import it as a side effect of Backup. Show “Newer/conflicting Drive version available”; preserve any distinct local branch as its own revision and use explicit Import to reconcile.

This is stricter than last-timestamp-wins. Clock skew, equal timestamps, edits/deletions, delayed uploads and two devices can defeat timestamp comparison. UUID + ancestry + logical-content checks gives retry/restore idempotency and detects conflicts without pretending a central lock or clock exists.

A new saved message after backup creates revision B whose parent is A. Repeated unchanged content requires no new upload. A retry of B does not create C. Do not trust wall-clock `updatedAt` alone: two devices can have skewed clocks or the same timestamps.

Retain immutable revision descriptors and sufficient verifiable lineage when intermediate pending payloads are coalesced; parent IDs alone do not prove ancestry if their referenced history is missing. If two devices extend A independently, store B and C as separate immutable branches. Even identical chat UUIDs do not justify last-writer-wins replacement. Use ancestry/content hashes to find safe descendants; retain both divergent heads and label conflicts during restore. Defer semantic message merging, automatic conflict resolution and a global mutable head pointer. Scanning multiple heads is preferable to losing a branch through a racing index update.

Proposed initial retention: no automatic remote revision deletion. Show storage usage and offer explicit cleanup of superseded, verified revisions after conflict handling is proven. Later bounded retention must preserve current heads, unresolved conflicts and recovery usefulness. Snapshots duplicate content, a deliberate first-version simplicity/storage tradeoff; do not claim unlimited storage.

## 7. Restore algorithm

1. Authorize the intended account; select/validate the proper namespace/folder and request decryption/recovery material if needed.
2. List every page, validate archive metadata/schema/size limits and group revisions by chat UUID and ancestry. Do not import intermediate/incomplete uploads.
3. Download into private staging. Reject path traversal, unsafe filenames, archive bombs, invalid IDs, unsupported schemas, invalid roles, corrupted JSON/checksums and failed decryption. Never execute imported content.
4. Preview counts: new, unchanged, safe newer versions, conflicts, missing attachments and rejected archives. A partial network failure must not be reported as a full restore.
5. Merge: unknown UUID → import; same revision/content → skip; remote descendant with no unsynced local divergence → update; local descendant → keep; divergent revisions → preserve the local chat and import the remote as an explicitly linked conflict copy with a new local record ID, retaining its portable conversation UUID and revision/branch lineage. Never concatenate two assistant/user branches blindly.
6. Recreate private attachment files and rewrite their references to new local paths. Preserve original chat/message IDs where safe, timestamps and prompt snapshots. Do not require re-downloading models to view restored chats; model loading is necessary only to continue inference.
7. Commit imported records and their backup ancestry only after files are staged/validated. Use crash-recoverable staging/transactions. If local content changed during preview/download, re-evaluate the merge before committing.
8. Sort history by original conversation start timestamp, newest first, with a stable UUID tie-breaker; use the existing local display timezone. Missing legacy times get an explicit fallback/unknown label rather than fabricated original times.

Restoring an already imported archive again must be idempotent, including conflict copies. Persist source namespace/chat/revision → local-record mappings so the second restore does not create a second copy. An imported revision keeps a verification receipt scoped to its exact source account/folder/environment, so restoring it does not immediately re-upload it to that same source. This does not mark a different destination backed up. Preserve revision descriptors even when equal logical content avoids a duplicate visible import; a reused revision ID with differing validated contents is corruption.

## 8. Deletion, switching accounts and failure scenarios

- **Delete locally:** remove local chat/attachment copies; preserve Drive backups by default. Explain that they can still be restored. Record an account-scoped local suppression/tombstone so an in-flight or queued pre-deletion upload cannot resurrect or upload that chat unnoticed. Explicit Restore may clear local suppression after confirmation.
- **Delete locally before first backup:** cancel its pending upload; no cloud protection exists yet. Warn about the unbacked state when appropriate.
- **Upload races local deletion:** cancel where possible and recheck suppression/consent before finalizing. If Google already accepted it, show the remaining backup and offer explicit remote deletion; do not promise cancellation erases a completed remote request.
- **Delete from Drive as well:** separate confirmed action covering all relevant revisions/conflict copies, with an exact scope preview. Cancel pending writes and track deletion state so other stale clients cannot silently recreate it. Robust all-device deletion/tombstone propagation is a prerequisite before promising delete-everywhere semantics; defer that button until designed/tested.
- **Backup folder/file removed or manually modified in Drive:** detect missing/corrupt data and show recovery choices. Do not treat a missing remote file as an instruction to delete the local chat or silently recreate a deliberately removed folder.
- **Uninstall/clear app data:** local files/keys/outbox disappear. Completed Drive backups remain subject to Google's/account/folder behavior; unfinished changes cannot be recovered from Drive. Reconnect the same account/folder and provide recovery material to restore.
- **Account switch:** stop workers first and invalidate the old consent session. Partition file IDs, outbox and restore mappings by account. Never redirect queued old-account chats to the new account without fresh, explicit selection/consent.
- **Expired/revoked permission:** attempt supported silent authorization once where appropriate, otherwise wait for user reconnection. No endless authentication retry or background consent UI.
- **Offline/interrupted request/server error:** retain the durable job, retry with bounded exponential backoff and jitter; reconcile unknown upload outcomes using the existing remote ID. No-network and Wi-Fi-only constraints are distinct.
- **Rate limit/quota/full Drive:** distinguish retriable rate limits from exhausted user storage or permissions. Show actionable status, retain local data, and resume after capacity/permission is fixed. [Drive error handling](https://developers.google.com/workspace/drive/api/guides/handle-errors).
- **Local storage full:** fail staging safely and preserve the source chat; do not mark it backed up. Allow pending-job recovery/cleanup without deleting conversations.
- **Clock/timezone changes:** use revision ancestry for correctness; preserve timestamps for display. Recalculate daily scheduling without duplicating immutable revisions.
- **Large/legacy/unknown-version backup:** enforce resource limits, migrate supported schemas and reject unsupported data without replacing local history. Missing attachments are reported explicitly; a restore is not complete merely because text was loaded.

## 9. Phased delivery and acceptance

**Phase 0 — policy and design:** obtain Google clearance; confirm visible-folder/scope restore behavior across reinstall, OAuth/signing setup, encryption/recovery UX, deletion semantics and account isolation. Nothing connects/uploads in this phase.

**Phase 1 — portable archives:** implement and test local export/import, schema/checksums, attachments, stable local/portable identity mappings, deterministic merge/conflict handling and recovery keys, using local fixtures only.

**Phase 2 — repository and manual Drive:** complete native durable repository/outbox migration first. Only after Google clearance and authorization/scope feasibility checks, enable Link / Store / Import / Disconnect using that queue, without automatic scheduling.

**Phase 3 — automatic backup:** enable native WorkManager hourly bounded batches, constraints, statuses and retry recovery through the same proven queue. Optional inactivity/daily modes, retention management and advanced bidirectional sync are later work.

Required tests include: first backup; identical retry after upload timeout; new messages after backup; streaming/Stop; duplicate restore; new-phone restore; wrong/missing key; corrupted/hostile archive; partial restore; concurrent edits on two devices; skewed clocks; equal timestamps with different content; restored IDs across multiple imports; edits during an active upload; repeated manual taps overlapping the hourly worker; queue coalescing and process death between upload verification/local acknowledgment; delete/upload race; disconnect/account-switch race; folder removal; Wi-Fi/mobile/offline; storage/quota/auth errors; process death/reboot; migration rollback; Dev/prod isolation. Verify no chat data reaches a PhoneGPT server, no credentials enter archives/logs, and unconnected users retain all local features.

Decisions proposed for approval before implementation: visible folder with narrow scope, encrypted archives/recovery key, backup-plus-explicit-restore semantics, hourly batching with a manual immediate run, local-only deletion default, no automatic pruning in v1, and durable chat/outbox storage migration. Provider permission remains a separate prerequisite.

## 10. Consistency contract and limits

Target invariants: no repeated visible chat from retrying the same restore; no clearing a newer dirty revision after an older upload; no silent replacement of a divergent branch; no “Backed up” acknowledgment before verifying the captured revision; and no automatic local deletion from missing cloud data. Prove these with crash/retry/concurrency tests rather than a “100% consistency” marketing promise.

While offline or paused, cloud data is intentionally behind local data. Google storage/account deletion, revoked access, device loss before backup, lost encryption keys and unpersisted streaming tokens can prevent recovery. Backups are eventually consistent when authorized connectivity/storage return and work is permitted to run; conflicts require explicit reconciliation. The UI must make pending or failed protection visible. Provider clearance remains required before implementation is enabled.

## 11. Execution and Home discoverability

The [staged multi-agent implementation plan](GOOGLE_DRIVE_IMPLEMENTATION_PLAN.md) assigns isolated write scopes, coordinator-owned shared integration, independent review and Dev-before-standalone release gates. Three planning reviews completed; implementation has not started.

Once provider and feature readiness exist, show an optional dismissible Home card below the chat/model actions: “Keep a backup of your chats”, “Optionally save chats to your Google Drive”, Connect Google Drive and Not now. Connect opens the backup settings/consent path; displaying the card starts no authorization or upload. Persist dismissal. Connected users get a compact status link instead; full Link/Store/Import controls remain under Settings. Do not promote a nonfunctional Drive connection in normal production builds before readiness. Audit Home, Settings, App Info and delete confirmation copy for accurate opt-in cloud behavior.
