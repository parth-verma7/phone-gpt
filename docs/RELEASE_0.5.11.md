# PhoneGPT 0.5.11 — search limit recovery

Date: 2026-11-08. Android version code: 25.

Cloudflare enforces 10 search reservations per network in a one-hour window beginning at its first request, plus the unchanged service-wide cap of 50 per UTC day. SEARCH_HOURLY_LIMIT and SEARCH_DAILY_LIMIT are owner-controlled Cloudflare Variables, not app settings or client input. The Worker is deployed; provider Secrets and the existing quota storage are preserved.

The shared mobile source parses 429 reset/start timestamps and numeric Retry-After safely. It shows when search becomes available and generates a local answer with explicit no-fresh-web instructions. No automatic retry or invented sources. The UI marks search as limited and keeps the notice with the answer. Other network/API errors retain their existing behavior. Changes affect Dev through Metro; installed Prod needs this new binary.

Validation: all 22 mobile test files, TypeScript, and 11 Worker tests pass. Worker tests cover concurrency, first-request window boundaries, denied-request accounting, trusted configuration and upstream-call suppression. Worker deployment version: ce728abf-1970-4030-86d4-b113dfc52e4c. Standalone release build succeeded. Artifact verification matched 64 source inputs, embedded rate-limit features, identity, native modules, icons, Hermes bytecode, ZIP/alignment and the 0.5.10 signing certificate. A54 acceptance remains pending.

Artifact: `PhoneGPT-v0.5.11-standalone.apk` (63,223,300 bytes). SHA-256: `7f3383b212ac8a1a28345fb5c76926dccbb24b46522dee9c0101cbe550dec9fb`.
