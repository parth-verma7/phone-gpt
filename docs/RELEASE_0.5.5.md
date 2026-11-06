# PhoneGPT 0.5.5 — production build

November 6, 2026. Android version code 19. Production build and artifact checks passed; not yet device-verified. Existing Dev APK receives shared JavaScript through Metro; no new Dev APK is being claimed built.

Includes staged generation controls with one numeric field and explicit Apply, shared compact controls and 0.8× default text size (saved choices preserved), local chat export with one All chats toggle and individual selection, Android destination guidance, and an off flag for uncensored model visibility. Previously downloaded files/chats are not deleted by the flag.

Web search remains a Dev-only pilot under its rollout guard, even though its source is in the repository. Production contains the ordinary local chat/voice features without exposing Web search. Export saves a ZIP through the current Android folder-access flow; select/create a subfolder such as Downloads/PhoneGPT. A native Save As change is planned, not in this APK.

Unit/regression tests and TypeScript passed. Physical installation, pending/applied colors, touch slider gestures, export folder/save/cancel and offline native chat/voice require A54 testing. No Play Store approval is claimed.

## Artifact

- File: `PhoneGPT-v0.5.5-standalone.apk`
- Bytes: 63,137,888
- SHA-256: `140f523e177d9d5325305d9e77e16e826904e5ac31d4341b1832acb0e910e5fc`

Verified 59 application source-map inputs against the checkout, embedded Hermes output, package identity/version, native module/logo presence, ZIP integrity/alignment, and update-signing compatibility against standalone 0.5.4. The browser check verified teal pending Apply, subdued/disabled Apply after commit, and removal of the repeated heading number; prior browser values were restored afterward. No new Dev APK or public release upload was created.
