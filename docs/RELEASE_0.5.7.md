# PhoneGPT 0.5.7 — refined theme colors

Date: 2026-11-06. Android version code: 21.

Removes White and Sage blue from the picker and adds Violet. Retains Teal, Light blue, Royal blue, Red and Pink. Existing Sage blue preferences migrate to Light blue; White returns to Teal, preserving independent dark mode. No chat/model data is removed. All 0.5.6 features remain shared between Dev and production.

Validation: theme contrast, preference hydration/persistence/migration tests and TypeScript passed. Production build succeeded in 1m16s. Artifact verification matched 61 application sources, packaged Hermes bundle, feature markers, native modules, identity/version, icons, ZIP integrity/alignment and the previous 0.5.6 signer. Native A54 acceptance remains pending. Chats-first navigation is a proposal, not implemented in this release.

Artifact: `PhoneGPT-v0.5.7-standalone.apk` (63,163,888 bytes). SHA-256: `9e95f9476d95339584221de398a3aee208015a726bf2de63a8abdc5addfa1181`. No public release upload is claimed.
