# PhoneGPT 0.5.8 — direct contact form

Date: 2026-11-06. Android version code: 22.

App Info → Contact sends the entered name, reply email and message through the website's Formspree endpoint. Removes the inbox address and email-app handoff. Message fields have no app-imposed maximum length or limit wording. Required-field validation, pending duplicate protection, a bounded request timeout, success acknowledgement and draft-preserving errors are included. Only contact fields are sent; chats/attachments are excluded. Inbox routing remains configured at Formspree.

Both build variants use this shared source. Chats-first navigation remains a proposal, not an implemented change. Validation uses mocked HTTP, long text, invalid fields, duplicate taps, timeout and retry/UI tests; no real contact message has been sent. 164 automated assertions and TypeScript passed. Production build succeeded in 55 seconds; source-map/Hermes/native-module/identity/icon/ZIP/signature checks passed against 0.5.7. The packaged bundle contains the form endpoint and no retired contact email or email-app action; native A54 delivery testing remains pending.

Artifact: `PhoneGPT-v0.5.8-standalone.apk`; 63,163,516 bytes. SHA-256: `115373cf9dfaec0d1a9c6593e3e7ff4762c19806efccc77856b70569a397c064`. Not uploaded as a public GitHub release.
