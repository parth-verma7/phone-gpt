# Google Drive backup — staged implementation plan

Updated: 2026-11-01. **Planning only. No application behavior, dependency, account or Google resource is changed by this plan.** Detailed semantics and provider constraints: [backup proposal](GOOGLE_DRIVE_BACKUP_PLAN.md). Product: [PRD](PRODUCT_REQUIREMENTS.md). Architecture: [technical design](TECHNICAL_DESIGN.md).

## 1. Delivery order and ownership

Three independent planning reviews completed on 2026-11-01: Hypatia (UX), Tesla (portable data/restore correctness) and Nietzsche (Android platform). No planning agent changed application files or connected accounts. Incorporate their corrections below before assigning implementation. The coordinator owns integration, shared contracts, documentation, verification and release sequencing. Multiple agents must not edit `App.tsx`, `package.json`, Gradle files or shared schemas concurrently.

The first implementable milestone is local archive export/import plus tested backup-domain logic. Drive connection/upload and automatic scheduling remain disabled until Google explicitly clears the proposed use case. UI can be developed against fixtures, but production must not offer a working-looking Connect action before authorization/provider readiness exists.

### Milestone A — prerequisites and contracts

Coordinator tasks:

1. Resolve Google policy clearance separately from user authorization/OAuth verification. Do not create Google resources or contact third parties under a planning-only request.
2. Define archive schema/version, canonical-content rules, revision ancestry, persisted operation identity, stable message-ID migration, public service interfaces and error/status vocabulary.
3. Confirm encryption/recovery-key UX and audit candidate native archive/crypto libraries before selecting dependencies. Do not invent a cryptographic implementation.
4. Define storage migration and restore transaction boundaries. Existing chat data must remain readable until migration validation succeeds; avoid an uncontrolled dual-writer system.
5. Establish package/signing/account/environment isolation, a feature-availability gate and local test fixtures. No token or chat content in diagnostics.

Exit: contracts and test vectors are stable enough for independent implementation; local existing chat behavior is unchanged. Google-specific integration remains a separate gated workstream.

### Milestone B — first parallel implementation round (future)

**Agent 1: product UI**

Proposed write scope: new `src/components/BackupHomeCard.tsx`, `BackupSettings.tsx`, `BackupRestorePreview.tsx` and UI-focused tests. Coordinator integrates props/navigation in `WelcomeHome.tsx`, `SettingsContent.tsx` and `App.tsx` after component review.

- Dismissible Home card below Start a conversation / Explore models: “Keep a backup of your chats”, a concise optional Drive explanation, Connect Google Drive and Not now. It never blocks chat or model discovery.
- Connected Home state: compact last-backup/pending status leading to Settings; no repetitive onboarding prompt. Respect saved dismissal until the user explicitly opens Settings.
- Settings → Backup & restore → Google Drive backup: Link Google Drive, Store to Drive, Import from Drive, then schedule/network/account/recovery controls.
- Model the disconnected, linking, connected-idle, uploading, pending/offline, authorization-required, storage-full, restoring and conflict states. Manual-only rollout must not expose an automatic schedule that is not operational. The current shared ActionButton disables busy actions; provide a separate actionable View backup progress control instead of treating that busy button as clickable. A fixture/test state must never claim a real account connection or successful cloud backup.
- Restore preview shows new/unchanged/updated/conflicting/rejected counts and allows cancel before mutation. Meet safe-area, keyboard, dark-mode, scaled-font and 44 px control requirements.
- Audit current Home/Settings/App Info privacy wording before making cloud opt-in visible. “All your chats stay only on this device” cannot remain an unconditional promise for opted-in users.

**Agent 2: portable archive and restore domain**

Proposed write scope: new `src/services/backup/schema.ts`, `canonical.ts`, `revisions.ts`, `restorePlan.ts`, their fixtures/tests and an archive adapter after its contract is agreed. Do not change the active repository or native dependencies independently.

- Define portable conversations/messages, original timestamps, prompt snapshots and attachment descriptors. Exclude absolute paths, model weights, raw recordings, tokens and unsent drafts.
- Canonical fingerprints ignore serialization order/local paths/export times/encryption randomness while including all backed-up logical content.
- Export consistent settled snapshots; stage/validate/decrypt archives before returning a deterministic restore plan. Keep codec, crypto and filesystem adapters separate from merge logic.
- Implement UUID/revision/hash skip-update-conflict rules, ancestry validation, stable conflict-import mappings and unknown-legacy lineage behavior. Distinguish local record ID from portable chat UUID/branch identity. Preserve revision descriptors when coalescing; equal content can skip a visible copy but cannot erase lineage. Same revision ID with a different payload is corruption. Message-prefix matching alone never proves overwrite safety.
- Validate schemas, roles, IDs, byte/file limits, checksums and unsafe archive paths. Missing attachments must be reported rather than silently replaced with fabricated content.

**Agent 3: durable local repository and outbox**

Proposed write scope: a new Android `backup/` package containing repository/DAO/migration/outbox classes and native unit tests, plus an agreed bridge declaration. Coordinator owns Gradle dependencies, package registration and replacing App persistence calls.

- Prototype Room/SQLite migration from AsyncStorage as a versioned, recoverable operation. This precedes manual as well as automatic Drive backup, since both use the durable queue. Retain the original store until IDs/counts/content/attachments validate; make cutover explicit. Retaining the old JSON is recovery evidence, not proof an older APK can safely read later database-only changes; define downgrade/export behavior.
- Save a chat change and dirty marker transactionally. Queue immutable captured snapshots, coalesce later pending edits, and acknowledge only the exact uploaded change sequence.
- Account/environment/folder/consent scopes are part of every queue/checkpoint key. Build a database-claimed runner with a recoverable lease/fencing token for both hourly and manual requests; different WorkManager unique names alone are not mutual exclusion. Persist generation ownership to recover abandoned holds after process death.
- Implement worker logic against a fake storage adapter first. No live Google endpoint, authorization prompt or UI claiming connected status.

Exit: local round-trip export/import and repository migration/rollback pass tests; UI state flows work against fixtures; existing chat/voice/download behavior still passes. Existing users must not need Drive to use PhoneGPT. A native migration is not shipped merely because the UI preview looks correct.

### Milestone C — integration and independent review round (future)

Coordinator integrates reviewed changes sequentially in the current source, updates both specifications and runs regressions. Use a second set of parallel bounded checks after implementation exists:

- **Data reviewer:** archive corruption/resource-limit tests, repeated imports, same-timestamp/different-content cases, divergent branches, migration recovery and attachment cleanup.
- **Lifecycle reviewer:** upload timeout/unknown outcome, crash between remote success and local acknowledgment, edit/delete/disconnect/account-switch races, duplicate manual taps and scheduled-worker overlap.
- **UX reviewer:** actual Home discovery/dismissal, Settings states, restore preview/cancel, accurate privacy copy, screen-reader labels, theme/font/keyboard and unconnected-user flows.

Review agents report concrete findings. Coordinator fixes integration issues and reruns affected tests. Do not treat three agent approvals as a substitute for a device test or provider permission.

### Milestone D — Drive integration, only after clearance

1. Complete the durable repository/outbox and validated encrypted staging from Milestones B/C before manual network backup. Then prototype native Google authorization on the correct Dev/release signing identities. Confirm narrow scope, explicitly bound account identity (do not infer it from authorization success alone), silent token reacquisition and interaction-required behavior without adding a PhoneGPT account/backend.
2. Validate visible-folder creation/reselection and restore after reinstall/on a second device. A matching folder name is not sufficient access/identity. Check complete pagination, quota errors and missing/deleted folder behavior. Folder reselection must not be assumed to grant recursive access to every historical child archive; prove it with the chosen scope/client or revise the design explicitly.
3. Add a real Drive adapter implementing the already tested storage port: list/metadata/read/create-with-stable-ID/verify, cancellation and typed errors. Include retry-stable remote file IDs and verify ambiguous upload outcomes.
4. Gate Connect and manual Store/Import behind actual readiness/consent. Manual backup and restore must pass before unattended uploads are enabled.
5. After manual queue behavior passes, enable constrained WorkManager hourly scheduling and a manual one-time trigger of the same runner. Initial batches: 20 chats/pass, one upload at a time, with persistent progress and follow-up work. Optional inactivity/daily modes remain later enhancements.
6. Derive backup environment from native build identity, validate account binding, define Wi-Fi transport versus unmetered policy, and exclude consent/tokens/outbox/key-bound state from inappropriate OS backup/device transfer. Review provider terms/OAuth, privacy disclosures and store data declarations against the actual implementation. Encrypted backup does not negate account metadata or Google's requirements.

Exit: explicit connection/manual backup/restore work on A54, account/environment isolation is proven, then scheduled/retry cases pass. No PhoneGPT server receives chats or backup keys.

### Milestone E — Dev validation, standalone parity and handoff

- Build/test Dev first; verify new native components on A54. JavaScript-only preview checks cannot validate WorkManager, OAuth, Keystore or storage migration.
- Exercise existing chat/model/voice functionality alongside backup, including constrained memory and network loss. Backup must yield rather than corrupt or block foreground chat.
- After Parth verifies the feature, rebuild standalone from the same final feature source, increment app/build versions and verify embedded configuration, signing/update retention and native modules.
- Record source state, artifact state and device acceptance separately. Update PRD, technical design, tracker and release notes together. Push verified changes to GitHub according to the existing user preference; no automatic store publishing.

## 2. Shared contracts to settle before parallel edits

These are design boundaries, not code already added:

- `ChatRepository`: local record IDs distinct from portable conversation/branch IDs, stable message IDs, atomic writes/revision markers, consistent snapshots, conditional restore commit and account-scoped suppression/checkpoint queries.
- `ArchiveCodec`: versioned encode/decode with attachment streams, schema/resource validation and integrity checking; injected audited crypto.
- `RestorePlanner`: pure deterministic compare/merge plan, no storage/network side effects; revalidate local version before commit.
- `BackupStore`: account-scoped inventory, immutable upload by persisted identity, read and verification; local fake implementation first, Drive later.
- `BackupCoordinator`: one runner per namespace, coalescing, bounded batches, retry/error classification, consent checks and verified acknowledgments.
- `BackupUiState`: typed status, account label, progress/pending count, last attempt, last completed pass and actionable error. Never include raw access tokens in React state exposed to logs.

New source file names above are proposed allocation boundaries, not claims those files exist today. Final types and native dependency versions must be chosen after feasibility spikes.

## 3. Non-negotiable acceptance cases

- Unchanged backups/repeated restores produce no duplicate visible chats or redundant full uploads.
- A pending chat can collect many messages before hourly backup; only its latest settled snapshot uploads unless an older snapshot is already in flight.
- New content during upload remains pending when the old snapshot is acknowledged.
- Different content with equal/later wall clocks never silently destroys another branch.
- Deletion commits suppression/cancellation/cleanup intent before removing files; failed metadata writes retain the files. Deletion/disconnect/account switches invalidate stale workers and prevent silent cross-account upload.
- An offline batch resumes from durable state; success counts refer only to verified complete revisions. No 100% immediate-consistency claim.
- An interrupted migration/restore recovers with original chats available, attachment references valid and no unsafe archive paths written.
- A new phone restores using the chosen account, folder and recovery material; device-only keys cannot be the sole recovery mechanism.
- Home dismissal is persistent, Settings remains discoverable, cloud consent is explicit and local-only users retain the whole existing app.

## 4. Current boundary

This planning task only creates/updates documentation. It does not authorize accepting provider terms, creating accounts, transmitting chats, changing user data storage, or shipping active Drive controls. The next implementation work should start with Milestones A/B; Google upload activation waits for Milestone D's prerequisite.

## 5. Review decisions incorporated

- Keep Google readiness gated at Home promotion, authorization, scheduling and HTTP dispatch, not only on a Settings button. Local fixtures are allowed; no active-looking fake cloud success in normal builds.
- Archive IDs/hashes and lineage must survive coalescing, retries and conflict-copy imports. Missing ancestry evidence means conflict; matching timestamps or message prefixes are insufficient.
- A restored revision's source verification receipt is scoped to that exact source/account/folder/environment, not universal proof it is protected at every destination.
- Manual and hourly backup share the same durable repository/outbox; native migration therefore precedes either live upload mode. Local archive export/import may still be developed first.
- Migration, deletion and restore must make metadata/file changes recoverable. Current effect-driven history persistence is not the future transactional commit contract.
- Explicit account identity, folder/child access after reinstall and worker-safe silent authorization are post-clearance feasibility spikes. If a spike fails, revise scope/UX/architecture rather than silently broadening access or adding a server.
