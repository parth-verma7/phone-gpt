# PhoneGPT 0.5.12 — compact search activity and Send scrolling

Date: 2026-11-08. Android version code: 26.

Replaces the centred search overlay with a compact inline activity card, removed when answer generation begins. Send resets stale scroll geometry and follows the new message despite prior momentum, while a newer reading gesture still cancels following. The public Worker endpoint stays in the app; moving URL discovery online would not make it secret.

Cloudflare audit: dashboard confirms SEARCH_HOURLY_LIMIT=10, SEARCH_DAILY_LIMIT=50 and the deployed hourly quota version. Historical request/IP logs remain disabled. Aggregate quota invocations do not prove more than ten searches were allowed for one network. Data Studio schema inspection returned SQLITE_AUTH, so stored per-network counters were not inspected. One non-sensitive live request from the development computer returned 200; this does not identify the phone’s past network identity or prove a quota bypass. The owner subsequently confirmed that the extra replies showed the search-limit/reset notice and local fallback. The quota investigation is resolved as working; there is no evidence of excess allowed web searches. No quota settings or provider secrets were changed in this UI release.

Validation: focused status/navigation tests pass, including actual Send with stale momentum and newer touch interruption. Full tests, TypeScript, production artifact verification and A54 checks are tracked below.

Verification complete: all 22 mobile test files and TypeScript passed. Release build succeeded, and artifact checks matched 64 source inputs, native modules, icons, Hermes bytecode, identity, ZIP integrity/alignment and the 0.5.11 signing certificate. Native A54 acceptance of the UI/scroll changes remains pending.

Artifact: `PhoneGPT-v0.5.12-standalone.apk` (63223440 bytes). SHA-256: `070c0c38f356fcc7715f1ea0fb843df87d87d5f776b1e17807e45634785adf5b`.
