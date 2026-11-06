# PhoneGPT project instructions

## Keep the two living specifications current

Parth requires documentation updates as part of completing relevant work, not as a later cleanup task.

- Update `docs/PRODUCT_REQUIREMENTS.md` whenever a feature/service is added, changed or shipped, or product scope, supported behavior, defaults or requirements change. Describe what users can do and why it belongs in PhoneGPT.
- Update `docs/TECHNICAL_DESIGN.md` whenever the implementation/design changes: technologies, services, dependencies, architecture, storage, APIs, inference, native behavior, privacy or build/delivery. Explain how it works, the reason for the decision and material tradeoffs/limits.
- A feature with technical changes normally requires updates to both documents. Pure technical changes require the technical document and the product document when user-visible behavior or promises are affected.
- Keep updates broad and useful: revise the affected sections to describe the current system; do not turn the documents into per-edit logs. For fixes, update them when documented behavior, design or constraints change.
- Distinguish implemented source/Dev previews, actually shipped artifacts and future plans. Never describe an unbuilt feature as already present in a standalone APK.
- Keep the tracker/release notes and README consistent where relevant. Update each specification's review date when changing it.
- Before declaring work complete or shipping, check which of the two specifications need updating and make those updates in the same change. If no update is needed, do not add filler.
