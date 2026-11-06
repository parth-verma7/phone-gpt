# PhoneGPT 0.5.3 — About, support and recommendation

2026-11-03. Android version code 17; iOS source build number 17.

Minimal App Info replaces the detailed biography/employer reference. Contact fields validate name, reply email and message, then open an email application addressed to parthvarma271@gmail.com for user review/sending. No contact backend, automatic delivery or chat upload was introduced. Failure preserves the draft and provides a copyable email. Qwen 3.5 0.8B now shows an editorial Preferred badge in Qwen → Censored; loaded/Selected behavior is unchanged.

The [store audit](PLAY_STORE_READINESS.md) concludes **not ready for submission**. Android and iOS store launches remain To-do. This release does not add AI moderation/reporting, change backup policy or prepare Play signing. iOS native compilation/signing remains unverified.

## Verification

Eleven JavaScript test files, TypeScript and whitespace checks pass. The six focused contact cases use mocked email opening; browser required-field validation and model grouping/Preferred appearance were checked. No real email handoff/send occurred.

Android Dev built before standalone. The artifact verifier matched all 46 local application source-map inputs to the checkout, confirmed production Hermes output, version/code, package identities, icons, native modules, live mode/cadence and both update certificates against 0.5.2. ZIP integrity and 16 KB ZIP alignment pass. All 23 standalone native libraries pass checked 16 KB ELF alignment; no model weights are bundled. This is not a 16 KB runtime/device test.

iOS prebuild and source-wiring checks pass at 0.5.3 / 17. CocoaPods/Swift compilation, signing and physical iPhone tests remain unperformed. No real contact email is sent during verification. Physical A54 checks remain pending; GitHub publishing waits for owner verification/explicit authorization.

## Local Android artifacts

- `PhoneGPT-v0.5.3-standalone.apk`: 63,018,588 bytes; SHA-256 `76922323196e3d38271955a8fef7396c6ef2109596a8fff676efe3d5a4d9cc2a`.
- `PhoneGPT-v0.5.3-development.apk`: 102,412,459 bytes; SHA-256 `2703048c5d360dc5a41bb2c0fee02465468f6c9235986829599c4759fe639b1c`.

Install over the matching existing app without uninstalling to retain its data. Standalone contains the updated code and runs without Metro after required models are available. Dev can receive these JavaScript changes through Metro on an already compatible Dev installation. These are local APKs, not a Play-signed release/AAB.
