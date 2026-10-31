# PhoneGPT UI polish and Play Store release

Updated: 2026-10-31. Current priority: a clean, smooth Android app without account requirements. No cloud account database or chat uploads in the first release.

## Design direction

Minimal with a subtle teal accent, approved by Parth. Use consistent SVG outline icons, soft neutral surfaces, readable typography, restrained rounded corners and clear button hierarchy in light and dark mode. Preserve font-size controls, safe areas, keyboard handling and user-controlled scrolling.

Dev source now includes refreshed Home, global theme, drawer icons/active navigation, SVG controls, Settings and App Info cards, shared chat/voice model action buttons and download progress bars, larger touch targets, and per-model offline/pause feedback and a Chat + shortcut. Android connection checks use local validated network capabilities without probe requests; manual Pause/Resume needs the rebuilt Dev APK. Existing DownloadManager tasks retain their old behavior. The earlier production freeze was lifted by Parth for the 0.5.0 sync; Dev and standalone are rebuilt together with the supplied logo. See [app-size audit](APP_SIZE_PLAN.md). Requires phone verification; not a finished launch audit.

## Next UI and experience work

- Source UI changes are verified in a web preview and by TypeScript/regression checks; Android Dev build passes. On-phone layout, actual downloads, connection transitions and inference performance still require device testing.

- Verify the initial refresh on A54, then refine Chat, model cards, voice models, Settings and App Info as one consistent system. Check small screens and 0.5–1.5× font settings, touch targets, contrast, pressed/disabled/loading/error states.
- Make first-run model selection understandable: download size, supported input, downloaded/loaded status, storage errors and useful recovery actions.
- Add connectivity feedback around downloads. Distinguish internet reachability from Wi-Fi attachment, allow cellular use with a clear large-download choice, and handle timeout/lost connectivity/retry. Local chat must not be blocked by network state.
- Keep the bundled catalog usable offline. Fetch only necessary model metadata/downloads with caching, bounded requests and errors; do not add unrelated APIs or remote dependencies for decorative UI.
- Profile long chats, token streaming, drawer scrolling, recording and cold starts. Confirm background downloads, model loading, memory pressure, keyboard behavior and app updates preserving data on physical devices.
- Confirm generated response formatting, text selection/copy, voice controls and draft behavior; keep operational details out of the normal chat flow.

## Release work

1. Verify developer account/identity in Play Console and confirm whether its testing requirement applies.
2. Prepare a production Android App Bundle (AAB), not the Dev APK. Replace the current debug-key release signing configuration with a dedicated upload-key workflow and Play App Signing. Preserve the original local APK key/artifacts; a Play-signed install may require a migration strategy for users of debug-signed APKs.
3. Check the target API required at submission, production permissions, exported components, dependency licenses, release-only configuration and all native library 16 KB page-size compatibility. llama/Whisper native libraries need explicit verification; do not assume a successful APK build proves compatibility.
4. Review the current `android:allowBackup="true"` setting and Android backup rules before finalizing the device-only privacy promise; OS-managed backup may copy app data according to platform/user configuration. Decide backup behavior explicitly for the release. Publish a public privacy-policy URL linked inside the app. Explain local chats, temporary audio, attached files, model-host network requests, data removal and any user-submitted support reports accurately. Complete Data safety based on actual app and SDK behavior, not merely the lack of login.
5. Review Google Play's AI-generated-content requirements, including an in-app reporting/flagging flow. Define a user-controlled reporting design that clearly shows what leaves the device; do not silently upload private conversations. Review the uncensored-model catalog and content safeguards against applicable policy before submission. Local inference does not itself establish compliance.
6. Create listing copy, support contact, icon, screenshots, feature graphic, content rating, target audience, ads and app-access declarations. Verify model licenses/distribution terms and disclose device/storage requirements accurately.
7. Run internal testing and pre-launch/device checks. For affected personal accounts created after 13 November 2023: closed testing with at least 12 testers continuously opted in for 14 days, followed by an application for production access. Meeting the duration alone does not guarantee approval.
8. Resolve findings, obtain Parth's phone verification, publish verified code, then submit the production release for review and roll out gradually. Store approval cannot be guaranteed.

## Official references

- [New personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Android App Bundles](https://developer.android.com/guide/app-bundle)
- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [16 KB page-size support](https://developer.android.com/guide/practices/page-sizes)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936)
- [Developer policies including privacy policy](https://support.google.com/googleplay/android-developer/answer/18258653)

Native download follow-up: the new foreground service declares `dataSync`, is user-started, retains partial data, exposes Pause/Resume/Cancel and handles Android background timeout with a retry message. Before Play submission, complete any required foreground-service declaration and test service lifecycle, notification behavior, timeout and restart on supported Android versions. See [Android foreground-service timeout guidance](https://developer.android.com/develop/background-work/services/fgs/timeout).
