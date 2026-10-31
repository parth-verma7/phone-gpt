# PhoneGPT authentication plan (deferred)

Updated: 2026-10-31. Planning only; no database, backend or sign-in implementation is authorized for the current UI/release work.

## Product decision

The first Play Store release has no authentication and needs no account. Prioritize a polished, smooth, private on-device experience. Chats, files, voice recordings, downloaded models and preferences stay on the phone.

Later, optional email/password sign-in can help identify customers who choose to register. This records registered accounts, not a complete count of app users. Anonymous users remain anonymous; do not add device tracking or analytics to infer their identity.

## Future user experience

- A small optional Sign in / Create account entry on the home page, with an equally clear Continue without an account action. Never block chat, downloads or voice behind login.
- Explain before signup: basic account details go to PhoneGPT's account service; chat contents remain on the device.
- Email/password only in the first authentication iteration. Google sign-in is a separate later backlog item.
- Verification, password recovery, logout and account deletion belong to the authentication release, not optional follow-ups.
- Existing local chat history remains device-local. Define and explain visibility when switching accounts before implementing authentication.
- Network is required for account operations; local models and chat remain usable offline, including after session expiry.

## Proposed future stack

- Existing React Native / Expo 57 app with SDK-compatible SecureStore for session credentials.
- Separate `phone-gpt-backend` repository: FastAPI, PyMongo async, Argon2id password hashing, short-lived signed access tokens and rotated refresh credentials.
- MongoDB Atlas, accessible only by the account service. Never bundle database credentials or signing secrets in the application.
- Transactional email provider for verification and password-reset links; choose hosting and email delivery during implementation.

## Separate Dev and Prod schemas

Create databases `phonegpt_dev` and `phonegpt_prod`, each with a `users` collection and the same versioned schema validator/index definitions. MongoDB uses collections rather than tables. Deploy schema migrations to Dev first, then Prod after verification.

Use separate service deployments, restricted database credentials, token signing keys and email configuration. Bind the Dev app to Dev and production app to Prod. Prefer separate Atlas projects/clusters when provisioning for stronger isolation. Test emails and customization belong only in Dev.

Proposed user document:

```json
{
  "_id": "immutable server-generated user ID",
  "email": "person@example.com",
  "emailNormalized": "person@example.com",
  "displayName": "optional name",
  "authProvider": "password",
  "passwordHash": "salted Argon2id hash",
  "emailVerified": false,
  "status": "active",
  "createdAt": "MongoDB UTC date",
  "updatedAt": "MongoDB UTC date",
  "lastLoginAt": "MongoDB UTC date or null",
  "sessions": [],
  "emailVerification": null,
  "passwordReset": null,
  "schemaVersion": 1
}
```

- Save basic information only when a user voluntarily registers; update last-login time on successful sign-in. Do not require phone number, address or other unrelated profile fields.
- Unique index on normalized email with a defined normalization policy; avoid provider-specific dot/plus rewriting.
- Store salted password hashes, never plaintext or reversible password encryption. Return only safe profile fields to the app.
- Bounded embedded sessions contain hashes of random refresh tokens, expiration and revocation/reuse metadata. Rotate atomically; propose 15-minute access tokens and 30-day refresh sessions.
- Verification/reset tokens are hashed, expiring and single-use. Validate expiry in the service and remove expired fields; do not put a TTL index on the user document, which would delete the account.
- One collection per environment initially. Preferences and conversations are outside scope.

## Future endpoints and delivery

- Register/login; verify/resend verification; forgot/reset password; refresh/logout; get/delete own account.
- HTTPS, generic credential errors, endpoint rate limits, minimal logs with no credentials/tokens, email verification and session revocation after password reset.
- Implement after the initial release: provision Dev resources, service/schema tests, home-page flow, updated Dev APK, offline/privacy and cross-environment tests, then Prod setup and standalone build.
- A signed-in customer count may be queried server-side later; no dashboard or tracking SDK is part of this plan.

## References

- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) — select the app's SDK-compatible version during implementation.
- [MongoDB Atlas database access](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)
