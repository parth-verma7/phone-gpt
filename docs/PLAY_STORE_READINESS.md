# PhoneGPT — store readiness audit

Reviewed: 2026-11-03. **Not ready for Play Store submission.** This is a repository/artifact review, not Google approval or legal certification. Play Console/account state and physical-device results were not available. Recheck policies immediately before submission.

## Verified baseline

The inspected 0.5.3 standalone APK targets Android API 36, minimum API 24, includes ARM64 native inference/transcription engines and no model weights. All 23 native ELF libraries pass the checked 16 KB alignment test; APK 16 KB ZIP alignment also passes. These checks do not establish successful runtime behavior on a 16 KB device. The update retains the prior native engines and local debug signing approach; its packaged checks are recorded in [release notes](RELEASE_0.5.3.md).

The shared application has local chats, downloadable models, streamed inference, voice typing, history controls and recovery UI. No mandatory account, chat backend or analytics service was added. iOS source preparation is separate from Android release readiness; no signed iPhone build exists.

## Submission gates still open

- [ ] **AI-generated-content safeguards and reporting.** There is no in-app response-reporting flow or demonstrated app-level prevention of prohibited generated content. Google requires both prevention and a reporting/flagging method that does not require leaving the app. The new About email handoff is ordinary support and does not satisfy this reporting requirement. Local inference does not provide an exemption. Community “uncensored” labels alone do not establish a violation or compliance; test actual behavior and design appropriate safeguards before submission. Any proposed reports must show exactly what the user chooses to share; never silently transmit chats. [AI policy](https://support.google.com/googleplay/android-developer/answer/13985936), [policy guidance](https://support.google.com/googleplay/android-developer/answer/14094294).
- [ ] **Release signing and bundle.** Release currently uses the local debug signing configuration, and no Play AAB has been produced. Set up a dedicated upload key and Play App Signing, safeguard credentials, build the production AAB and validate Play-delivered splits. Preserve the existing local APK signer; decide migration/data preservation for users of those APKs before changing distribution signing. [App signing](https://developer.android.com/studio/publish/app-signing), [Play signing](https://support.google.com/googleplay/android-developer/answer/9842756).
- [ ] **Public privacy policy and accurate disclosures.** No verified public policy URL/in-app link exists. Cover local chats, TXT attachments, temporary microphone recordings, model-host requests, SDK behavior, voluntary support email, deletion and platform backups. Android currently has `allowBackup=true` without explicit extraction rules; resolve this before promising strictly device-only storage. Complete Data safety from actual release behavior, including SDKs, rather than assuming that no login means no disclosures. [User data policy](https://support.google.com/googleplay/android-developer/answer/10144311).
- [ ] **Permissions and background service review.** The merged release manifest includes microphone, network, dataSync foreground service, legacy storage permissions limited to API 32, SYSTEM_ALERT_WINDOW, VIBRATE and CAMERA from installed dependencies. Camera is not used by the current TXT-only flow. Remove unnecessary release permissions/dependencies after compatibility checks. Complete applicable foreground-service declarations and evidence in Play Console; test notification, cancellation, timeout and restart behavior. [Foreground-service declarations](https://support.google.com/googleplay/android-developer/answer/13392821).
- [ ] **Physical runtime and privacy acceptance.** Complete the [A54 checklist](A54_TEST_CHECKLIST.md), airplane-mode cold start, update data retention, long-chat memory/thermal behavior, microphone denial/cleanup, download lifecycle and 16 KB runtime testing. Static alignment is only one part of native compatibility. [16 KB guidance](https://developer.android.com/guide/practices/page-sizes).
- [ ] **Account and testing access.** Verify the developer account, identity and production-access status. If this is a personal account created after 13 November 2023, the documented requirement is at least 12 testers continuously opted in for 14 days, followed by an application for production access. Account type/date are unknown; eligibility and approval cannot be inferred from the repository. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).
- [ ] **Listing, declarations and licensing.** Finish screenshots, feature graphic, descriptions, support email, target audience, content rating, ads/app-access declarations and SDK/model license/distribution review. The logo and a support address are present; that is not a complete listing or rights audit. [Listing assets](https://support.google.com/googleplay/android-developer/answer/9866151).

The checked APK targets API 36, matching the currently documented general phone-app submission requirement. Recheck at the actual submission date. [Target API policy](https://support.google.com/googleplay/android-developer/answer/11926878).

## Recommended order

1. Decide the AI safeguards/reporting and privacy/backup design; these affect product behavior and disclosures.
2. Remove unused release permissions, finish the public policy/listing and prepare secure signing/AAB delivery.
3. Test the actual Play candidate internally and on physical devices, complete any required closed test and resolve findings.
4. Obtain owner verification, publish verified code, submit for review and roll out gradually. No audit or successful build guarantees approval.

## iOS launch remains To-do

Obtain Expo/Apple developer distribution setup, compile the prepared native project on a macOS build host, fix native findings, sign and test through TestFlight on iPhone, then complete App Store privacy/listing/review work. An Android APK cannot install on iOS. The owner currently has an iPhone only; no paid account, cloud build or submission was initiated. See [iOS handoff](IOS_BUILD_AND_TEST.md).
