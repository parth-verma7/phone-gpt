# PhoneGPT 0.5.13 — saved instruction versions

Date: 2026-11-09. Android version code: 27.

- Save, preview and restore local system prompt versions for new conversations.
- The original bundled PhoneGPT default is permanently available outside the 50 user-version slots. Restoring it works even when history is full.
- Save, Restore default and History share a compact wrapping row. Existing conversations retain their prompt snapshots.
- Legacy plain-text preferences migrate on changed Save using a separate history key. Full history rejects saves without automatic pruning; confirmed entry removal frees space. Limits: 50 entries, 64,000 combined text characters, 16,000 characters per prompt.
- Existing chats remain usable if prompt hydration fails; new conversations receive an explicit error instead of a silent send failure.

No new native dependency or search API change. Local prompt data can be included in Android-managed backups under the current backup configuration. Dev and production retain separate local storage.

TypeScript and all 199 regression tests passed. APK verification matched all 64 application source inputs, checked embedded prompt-history markers, identity/version, Hermes output, native modules, icons, ZIP integrity/alignment and an update certificate matching 0.5.12. A54 physical-device acceptance remains pending. Install over the existing production app to preserve its local data.

Artifact: `PhoneGPT-v0.5.13-standalone.apk` (63,229,600 bytes). SHA-256: `d3c25222f0829d731709a0e0264a57c2f49b15531e362ba43c74cf6fcd602327`.

Published release location: https://github.com/parth-verma7/phone-gpt-website/releases/tag/android-v0.5.13 . Website download links are updated with this release.
