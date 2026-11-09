# Data safety preparation — PhoneGPT

Reviewed against current source on 2026-11-09. Preparation notes, not submitted Play Console answers or a completed SDK/network audit. Policy URL: https://phone-gpt.pages.dev/privacy/ . The same link is available in Settings → About PhoneGPT → App info & contact and beside the contact form in 0.5.14.

## Match declarations to actual flows

- **Local chat/voice/files/settings:** model inference, recordings, attachments and chat persistence are processed on device. Do not classify these as uploaded simply because microphone/file permissions exist. Web-search text is a separate off-device flow; it may contain personal information the user includes.
- **Web search:** a search question is transmitted to the Cloudflare search service and Brave. The app does not attach saved chat history, attachment files or raw voice recordings. Cloudflare necessarily processes network requests; the quota component stores a keyed IP-derived identifier/counters, with a one-hour per-network window and a UTC-day service counter. Expired entries are scheduled for deletion; that does not specify all infrastructure/provider retention. Do not call the identifier fully anonymous or claim all data is purely ephemeral.
- **Contact form:** voluntary name, reply email and message go to Formspree and the recipient email service. The website can additionally submit a topic. Contact messages persist for enquiry/follow-up, with no configured automatic deletion schedule. Privacy/deletion enquiries use the same contact form; removal is a manual process for copies under our control. Do not declare that the app never collects personal data.
- **Model downloads:** HTTPS requests to catalog model hosts reveal ordinary request/network information. Recheck each enabled host and installed SDK before final declarations.
- **Android backup and export:** platform backup is enabled. Exported ZIPs are separate user-controlled copies and are not encrypted by PhoneGPT. The app does not have a Drive/chat-backup service or mandatory account.

## Remaining owner/Console review

The release's actual data categories, purposes, required/optional controls, retention and sharing classifications must be completed in Play Console after reviewing provider/SDK behavior. Service-provider and user-initiated-transfer exceptions to "sharing" require the applicable conditions; they are not automatic exemptions from collection disclosure. Do not select "no collection" merely because core inference is local. No Console form, consent or declaration was submitted by the agent.

Google distinguishes on-device processing from off-device collection, and separately defines ephemeral processing and sharing exceptions. Use the live guidance when filling the form: https://support.google.com/googleplay/android-developer/answer/10787469 . Privacy-policy requirements: https://support.google.com/googleplay/android-developer/answer/10144311 . The contact form does not replace AI-content reporting/safeguards.
