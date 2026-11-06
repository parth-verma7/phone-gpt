# PhoneGPT 0.5.4 — matching Dev and standalone rebuild

November 5, 2026. Android version code 18. Both APKs were rebuilt from the same checkout. Version labels distinguish this installation from older APKs. No new inference behavior was introduced.

Maximum reply length and Conversation context sliders, presets and custom token inputs are present in Settings → Generation and expanded model options. The prior 0.5.3 build source map already contained these controls; the exact installed phone version has not been inspected. This release repackages current source with an identifiable version rather than claiming a reproduced slider-rendering fix.

## Verification

JavaScript tests and TypeScript passed. The artifact verifier matched all 46 application sources in the standalone source map against the checkout, compared packaged Hermes output to generated output, checked embedded token-control markers, app identities/version labels, matching Dev/Prod signing certificates, native modules, icons, ZIP integrity and ZIP alignment. No old standalone APK remained locally for comparison to its signer; no device was connected. Physical installation, slider visibility/gesture behavior and offline inference need A54 verification.

Dev server: LAN port 8083. Dev uses Metro; production embeds code and must be updated by installing the rebuilt APK. Install over the matching app, rather than uninstalling, to retain local data where Android permits it.

## Artifacts

- `PhoneGPT-v0.5.4-standalone.apk`: 63,018,588 bytes; SHA-256 `b6a1696f18f33cb53ea48e7cc266843aec34410c04ff9f5e133e3e92cf1a053c`.
- `PhoneGPT-v0.5.4-development.apk`: 102,412,459 bytes; SHA-256 `5959105192255561b0d715cf0bf4cefd6d9baf3275d563b5e5402420c36c518d`.

iOS source version/build metadata was advanced to 0.5.4 / 18 for consistency; native iOS compilation/signing remains unverified. No public APK release was changed during this rebuild.
