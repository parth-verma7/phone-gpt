# PhoneGPT 0.5.10 — Dev/Prod feature sync

Built: 2026-11-08. Android version code: 24.

Standalone production is rebuilt from the same current feature source as Dev. Includes:

- Visible, editable PhoneGPT system prompt with direct answers, concise paragraphs/bullets and optional relevant follow-ups. Existing custom instructions remain intact.
- Web answers without source narration in the response; source cards remain separate. Collapsed per-question search-decision summaries distinguish routing, lookup and the open final answer without exposing raw router output or adding a model call.
- Clickable supplied Markdown links and bare HTTP(S) URLs; plain website names do not become guessed links.
- Settings ordered Appearance, Text size, Generation, System prompt, About PhoneGPT.
- Context Apply saves without opening Chat or loading a model. A changed ready context requires the explicit Load action before sending; no Preparing-your-message status.
- Start-time-only chat list labels, plus the existing navigation, export, download recovery, live transcription, themes, token controls and optional web-search feature set.

No new native dependency. Prod keeps its application ID and signing certificate; Dev retains a separate identity/data store and Metro delivery. Prod embeds Hermes code and requires no development server for startup or local inference. Web search and model downloads still need internet. No signed iOS build is produced.

## Verification

- All 21 JavaScript test files passed; TypeScript and whitespace checks passed.
- Gradle release build succeeded. Artifact verification matched 63 packaged application source inputs to current files, checked embedded feature markers, manifest identity/version, icon assets, native voice/chat/download modules, Hermes bytecode, ZIP integrity and 16 KB alignment.
- Signing certificate matches standalone 0.5.9 for an in-place update.
- Browser Settings order and context Apply were checked. Installation, native inference, microphone performance, link opening and offline behavior on A54 remain device acceptance checks.

Artifact: `PhoneGPT-v0.5.10-standalone.apk`
Size: 63,219,088 bytes (~63.2 MB).
SHA-256: `4488c777ae2125b7279d1aeb0cef067abde84cadd8b91f13e8cda0c162b34087`.

The APK is a local build; this task does not upload it to GitHub Releases or update the website download URL. Install over the existing production app rather than uninstalling to retain its local data. Play Store signing/submission remains separate.
