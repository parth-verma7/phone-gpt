# PhoneGPT 0.5.6 — production parity and theme colors

Date: 2026-11-06. Android version code: 20.

Adds seven saved theme colors in Settings → Appearance with separate light/dark mode. Synchronizes current Dev features into standalone production: optional Web search, direct grounded answers with separate sources and input-context tracking, compact Qwen/Gemma/DeepSeek models, context slider/custom choices including 10k/20k, ready-audio voice transcription and blank-marker filtering, streaming scroll-intent fixes, and local chat exports. Uncensored model rollout stays off.

Web search uses the existing Cloudflare/Brave proxy and existing shared daily quota; it requires internet. Model inference, voice and stored chats remain local. Production embeds its bundle and does not need Metro to start. Dev has its separate app identity and storage.

Validation: 163 automated assertions across 17 test files, TypeScript and whitespace checks passed. Browser preview reviewed in light/dark modes. Standalone build succeeded in 49 seconds. Artifact verification matched 61 packaged application sources, Hermes bundle output, expected feature markers, native modules, icons, identity/version, ZIP integrity/alignment and the prior 0.5.5 signing certificate. No A54 device was connected; native microphone/inference/lifecycle acceptance remains pending.

Artifact: `PhoneGPT-v0.5.6-standalone.apk`. Size: 63,163,916 bytes. SHA-256: `72d90f177dd8c1f6260f56ffef48121cadf2b62f77b8764a3ff82c2ebd6387a7`. No public release upload or installed-device update is claimed.
