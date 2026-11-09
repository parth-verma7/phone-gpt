# Google Play bundle handoff

Built and verified 2026-11-09. This is a local upload artifact for internal testing, not Play approval or a production rollout.

## Upload file

`PhoneGPT-v0.5.14-play.aab` at the repository root. Package `com.phonegpt.app`, version 0.5.14, code 28, ARM64, minimum Android 7/API 24 and target API 36. Size 49,914,772 bytes (~49.9 MB), not the Play download or installed size. SHA-256: `3a1a6f70933bbf16d35ea6230359ddbb1acc31e77bbd2dc7136beabe1e6835d9`.

Upload the **AAB only** to a Play Console internal-testing release. Configure Play App Signing as directed by Play Console. Do not upload private keys or password files as app artifacts. No Play Console upload, signing enrollment, review, release or installation was performed by the agent. Other store-readiness tasks remain open; see [audit](PLAY_STORE_READINESS.md).

## Private upload credentials

The local setup keeps its encrypted PKCS12 keystore and plaintext, owner-readable-only credential properties outside this repository under `../.phonegpt-tools/signing/`:

- `phone-gpt-upload.p12`: encrypted private upload key.
- `phone-gpt-upload-signing.properties`: key location, alias and generated password; contains a secret in plaintext and must be protected along with the key.

Directory permissions are 0700; both files are 0600. Neither is committed or embedded in the AAB. Back up both together in trusted encrypted storage or a password manager. Do not paste their contents into chat, GitHub, public releases or the website. Reuse this upload key for future uploads; do not reinitialize it for each build. The initializer refuses to replace existing signing files.

Upload certificate SHA-256: `f794060c82142a608a47e5d9e26e66d1868fc9e6c623e1b1939ac0fd83576878`. This certificate fingerprint is public information, not the private key.

## Rebuild and verification

With Node, JDK 17 and Android SDK available:

```
npm run build:android:play
python3 scripts/verify-play-bundle.py --bundletool /path/to/bundletool-all.jar --build-tools /path/to/android-sdk/build-tools/36.0.0
```

For a new machine only, first restore the private signing files, or explicitly initialize a new upload key if this is a new unpublished project using `npm run signing:android:play`. `PHONEGPT_UPLOAD_PROPERTIES` can override the private properties location; the build wrapper rejects a location inside the app repository. Credentials are passed through a private file, not password command-line arguments.

The dedicated build requests `:app:bundleRelease -PphoneGptPlaySigning=true` with the existing ARM64 CPU engine variants and production JavaScript. Direct bundleRelease without dedicated signing is rejected. Website `assembleRelease` keeps its historical signer; this change does not replace the published standalone APK or its update identity. Public AABs contain the upload certificate, not its private key/password.

Google Play signs delivered APKs with the Play app-signing key, which is distinct from the upload key. Existing website APKs use their earlier signer; an in-place transition to the Play build is not established and must be planned/tested to preserve local data. Upload key signing does not make the Play app compatible with existing direct-install certificates.

## Verification performed

- Google bundletool 1.18.3 downloaded from its official release and checked against the published SHA-256.
- Bundle validation and release manifest/package/version/target checks.
- AAB JAR signature and upload-certificate match. Self-signed upload certificate trust/timestamp warnings are expected and are not a CA certificate requirement for Android app signing.
- All 64 packaged application sources match current files; current prompt/voice/search markers and embedded output checked.
- No model weights, keystore files or generated signing password in the archive.
- Generated a universal test APK, verified its signature and 16 KB ZIP alignment; no device install. Temporary passwords and generated test artifacts were removed.
- Five signing-lifecycle unit tests, existing 23 JavaScript test files and TypeScript checks pass.

Play-delivered split behavior, physical-device testing, 16 KB runtime testing, privacy/permissions/reporting/licensing and the rest of the listing/review gates remain outstanding. A valid signed AAB is not a promise of store acceptance.
