# Samsung A54: short Dev verification

Updated 2026-10-31. Test in **PhoneGPT Dev**, or use the matching standalone PhoneGPT app for full offline checks. No authentication or telemetry was added.

## Setup

- Use the latest `PhoneGPT-v0.5.0-development.apk`. Install the newly rebuilt Dev APK for manual Pause/Resume. It contains a native resumable download service; Metro alone cannot add this capability. Installing over Dev with the same signature preserves its data. The + shortcut itself is JavaScript-only.
- Run `npm run start:dev` in this repository. Connect Dev to the displayed LAN address on port 8083 with phone/computer on the same Wi-Fi. Reload once to receive the changes.
- Avoid uninstalling/clearing app data: that deletes downloaded models and chats. Installing the matching signed Dev update normally preserves them.

## First: manual pause and new-chat shortcut

- Start a **new** transfer after updating Dev. Press **Pause**. Expect **Paused by you**, stable progress and a **Resume** button. Pause may briefly show Pausing while the connection closes. Leave/reopen the app, reconnect to Metro and confirm it remains manually paused even with internet available. Press Resume and confirm it continues. If a host has no usable validator/resume support or changed its file, a safe restart may be required.
- Turn internet off during an active transfer: only that model shows **No internet**. Restore internet: it should resume automatically. A manually paused download must remain manually paused.
- Existing transfers from before this APK stay with DownloadManager and cannot be manually paused; let them finish, or explicitly cancel/restart if you want to test Pause. Existing installed model files are retained.
- In an already empty Chat, type a disposable unsent draft and press top-right **+**. Expect the same UUID, draft and attachment to remain. From a conversation with messages, press **+**: expect a fresh empty chat; saved conversations remain in history. Hover (web) or hold (phone) for Start a new chat. The shortcut is disabled during generation/voice processing.

## Drafting and send scrolling

- In a long chat, scroll up, then send a message: the view should jump to the new sent message before model output starts.
- While a long reply generates, type your next message. The keyboard/input should work and Send should remain disabled. When generation ends, the draft must still be there and become sendable; it must not be sent automatically.
- Scroll up while the response streams: it should let you read older messages without pulling you down. Sending your next message should resume following the newest content.

## Stop generation

- Request a long reply. Type a next draft while it streams, then press the square Stop button in place of Send. Expect a brief Stopping status, no further text after it settles, the partial reply still visible, and your draft preserved and sendable.
- Repeat and press Stop before the first token. Expect no fake assistant response or generation-error bubble. Send again to confirm the model still works.
- Reopen the conversation and verify the partial reply is in its history.

## Search saved conversations

- Open the hamburger menu and tap the magnifying glass beside **Chat History**. There should be no search button in the Chat header. The drawer should close before search opens. Expect a full-screen view and focused search field, with conversations newest-started first. It searches this app's local history only (Dev and production still have separate data).
- Search for a word from an older user or assistant message, then a substring from its middle/end, and try different capitalization. Expect matching conversations and highlighted title/snippet matches.
- Search punctuation literally (for example `.*`), then a word absent from your history. Check no-results and Clear behavior; tap a result to open its whole conversation. Close or Android Back should return to Chat.
- Check with keyboard open, dark mode and larger text. Search is disabled while generating or voice typing, so stop the active operation first.

## Delete a saved conversation

- Use a disposable chat in the drawer history. Tap its trash button and cancel: nothing should change. Confirm deletion: only that conversation should disappear, including after reopening the app.
- Repeat from search results. Deleting must not open the conversation. Other conversations and downloaded models must remain.
- Delete the currently open disposable chat: expect a fresh empty chat. Its private attachment copies should be removed; original source documents remain untouched.
- During generation or voice processing, deletion should be disabled.

## Other checks

1. **Download and connection recovery** — in Models → Voice, start an unneeded small model (Tiny English is about 78 MB). While downloading, turn off Wi-Fi and mobile data. Allow time for Android to detect the interruption. The affected model should show **No internet** near its progress. There is no global connection banner. Restore connectivity. The same task should continue; if Android reports a terminal failure, use Download/Retry instead. Allow a few seconds for network detection; do not reload Dev while disconnected.
2. **Browse while downloading** — before the transfer finishes, expand another model family and visit Home, then return. The original transfer should continue. Swipe Dev out of recent apps while a transfer is active, reopen/reconnect, and inspect the task: progress/completion should be restored rather than a duplicate download starting. Do not use Android Force stop or uninstall for this check.
3. **Explicit cancellation** — start another model you do not need and press its X. That task should stop and return to a download action. Downloading it again should work. Cancellation intentionally removes its partial file.
4. **Load and chat** — load an already downloaded chat model, send two messages including a fact you ask it to recall, and check the transcript remains visible. An inference/model-load error should offer **Retry loading** when the file is already present. We do not need you to deliberately corrupt a file to test this. If a failure occurs naturally, record the message and which action was available.
5. **Voice and controls** — select Tiny/Base, dictate, stop, edit and send. Check the corrected live-dictation description, progress buttons and cancellation; repeat once. Do not delete your current model unless you intend to remove its file. Chat generation should keep model-delete/load controls disabled.
6. **Layout** — check Chat with the Samsung keyboard open, scrolling up during generation, model options, Settings and App Info. Try dark mode and 0.8× / 1.5× text sizes. Look for clipping, tiny touch targets, unwanted scrolling or controls hidden by system bars.

## Offline caveat

A Dev app still needs Metro to load/reload JavaScript. After disconnecting the network, do not interpret a Dev-server reconnect warning as model-inference failure. Already loaded code/models may keep working, but cold-start airplane-mode validation must use the standalone APK rather than Dev. The 0.5.0 standalone is rebuilt from the same feature source; use it for that check.

## Report back

For each issue, send: test number, model name, what you tapped, expected/actual result, exact error text and whether retry worked. A screenshot is useful for layout problems; no need to share private chat content. No remote crash-reporting or analytics SDK is needed for this test cycle.
