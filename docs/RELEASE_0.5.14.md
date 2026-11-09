# PhoneGPT 0.5.14 — privacy policy access

Date: 2026-11-09. Android version code: 28.

- Add a prominent Privacy Policy action in App Info and beside the contact form. It opens the public HTTPS policy and gives a manual URL if opening fails.
- Explain the web-search request separately from local chat storage; qualify temporary recording cleanup and Android-managed backups.
- Public policy now identifies PhoneGPT/Parth Verma explicitly, explains local/export/search-counter/contact retention and provides a privacy/deletion enquiry mechanism without publishing the inbox address. No automatic contact-message deletion system is added or claimed.
- Produce a new signed Play AAB using the existing private upload key and a standalone APK using the existing direct-install signer. No Play Console upload or declaration submission is performed.

Google Play Data safety declarations and store/device acceptance remain separate. See [preparation notes](PLAY_DATA_SAFETY_REVIEW.md). TypeScript, 23 JavaScript test files and five signing-lifecycle tests pass. Both artifacts match 64 current application source inputs. The AAB passes bundletool validation, upload-certificate and generated-APK checks; standalone signing matches 0.5.13. Physical-device acceptance remains pending.

Standalone: `PhoneGPT-v0.5.14-standalone.apk`, 63,231,148 bytes; SHA-256 `d72a49cfa9d07d279a51eada810720df70b1145d2a37798a5ee22a8b47bff380`.

Play bundle: `PhoneGPT-v0.5.14-play.aab`, 49,914,772 bytes; SHA-256 `3a1a6f70933bbf16d35ea6230359ddbb1acc31e77bbd2dc7136beabe1e6835d9`.
