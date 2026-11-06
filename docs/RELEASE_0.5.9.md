# PhoneGPT 0.5.9 — conversation list and safer editing

Date: 2026-11-06. Android version code: 23.

Keeps Home as the opening page and adds Home/Chats/Models/Settings bottom tabs. Chats shows the conversation list with first-message titles, creation timestamps, last-message previews, inline search and Export. App Info/Contact is under Settings. Individual chats have Back to Chats and internal UUIDs are no longer shown as titles. Common Markdown is cleaned for list/title display; original messages remain intact. New chat is a filled theme action.

Edit replaces row trash icons with checkboxes, Select all matching results and confirmed Delete selected. Existing durable per-chat deletion runs sequentially and reports partial failures. Unsent drafts are kept in memory across saved-chat switches.

Ambiguous web routing uses a brief YES/NO completion and falls back locally for unusable decisions rather than failing the chat. Explicit search/no-search rules remain. Web on is filled and off neutral.

Validation: 180 automated assertions and TypeScript passed before final packaging; browser navigation/empty-state checks performed. Production build succeeded in 34 seconds. Artifact verification matched 61 included application sources and checked Hermes/embedded features, native modules, icons, identity, ZIP integrity/alignment and signing compatibility with 0.5.8. Native A54 inference, model loading, keyboard, voice, deletion and search acceptance remain pending. No new native dependencies.

Artifact: `PhoneGPT-v0.5.9-standalone.apk`, 63,213,856 bytes. SHA-256: `135abeb00ffe123303ab6ddb29a7c9718c675e3e4d0267d08b31244d75d36761`. No public release upload or A54 install is claimed.
