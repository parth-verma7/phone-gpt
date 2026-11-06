# Samsung A54: short Dev verification

Updated 2026-11-02. Test in **PhoneGPT Dev**, or use the matching standalone PhoneGPT app for full offline checks. No authentication or telemetry was added.

## Setup

- Use the latest `PhoneGPT-v0.5.2-development.apk`. Install the newly rebuilt Dev APK for manual Pause/Resume. It contains a native resumable download service; Metro alone cannot add this capability. Installing over Dev with the same signature preserves its data. The + shortcut itself is JavaScript-only.
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

## Flexible token controls (0.5.1)

- Reload Dev from Metro, or install the 0.5.2 standalone over production. Existing Dev native modules are compatible; production needs the new embedded bundle. In Settings → Generation and model options, check reply presets, sliders and custom fields. Defaults remain 384 reply / 2048 context. Sliders start at 384 reply / 1024 context, and extend beyond the preset buttons to the shown range.
- Apply 1200 reply tokens. Enter zero, decimals, negative values and values above the shown limit: expect a validation message and no saved change.
- Load a model and check its GGUF context ceiling appears. Set 8192 (if supported), drag the context slider and release: reload should happen only once on release. Larger windows may exceed A54 RAM; check error/recovery using a smaller context if loading fails.
- Set a large reply ceiling and send a short prompt: the available input/context space should reduce the actual reply budget instead of blocking an otherwise valid turn. Stop still works. Switch to a model with a smaller context ceiling: values must be adjusted to fit.
- Reopen Settings and restart Dev to check values persist. Test dragging with the Samsung keyboard closed, dark mode and enlarged text.

## Other checks

1. **Download and connection recovery** — in Models → Voice, start an unneeded small model (Tiny English is about 78 MB). While downloading, turn off Wi-Fi and mobile data. Allow time for Android to detect the interruption. The affected model should show **No internet** near its progress. There is no global connection banner. Restore connectivity. The same task should continue; if Android reports a terminal failure, use Download/Retry instead. Allow a few seconds for network detection; do not reload Dev while disconnected.
2. **Browse while downloading** — before the transfer finishes, expand another model family and visit Home, then return. The original transfer should continue. Swipe Dev out of recent apps while a transfer is active, reopen/reconnect, and inspect the task: progress/completion should be restored rather than a duplicate download starting. Do not use Android Force stop or uninstall for this check.
3. **Explicit cancellation** — start another model you do not need and press its X. That task should stop and return to a download action. Downloading it again should work. Cancellation intentionally removes its partial file.
4. **Load and chat** — load an already downloaded chat model, send two messages including a fact you ask it to recall, and check the transcript remains visible. An inference/model-load error should offer **Retry loading** when the file is already present. We do not need you to deliberately corrupt a file to test this. If a failure occurs naturally, record the message and which action was available.
5. **Voice and controls** — select Tiny/Base, dictate, stop, edit and send. Check the corrected live-dictation description, progress buttons and cancellation; repeat once. Do not delete your current model unless you intend to remove its file. Chat generation should keep model-delete/load controls disabled.
6. **Layout** — check Chat with the Samsung keyboard open, scrolling up during generation, model options, Settings and App Info. Try dark mode and 0.8× / 1.5× text sizes. Look for clipping, tiny touch targets, unwanted scrolling or controls hidden by system bars.

## Offline caveat

A Dev app still needs Metro to load/reload JavaScript. After disconnecting the network, do not interpret a Dev-server reconnect warning as model-inference failure. Already loaded code/models may keep working, but cold-start airplane-mode validation must use the standalone APK rather than Dev. The 0.5.2 standalone is rebuilt from the same feature source; use it for that check.

## Report back

For each issue, send: test number, model name, what you tapped, expected/actual result, exact error text and whether retry worked. A screenshot is useful for layout problems; no need to share private chat content. No remote crash-reporting or analytics SDK is needed for this test cycle.

## About and catalog (0.5.3)

- Open App Info in both themes and at small/large text scales; confirm no employer/detailed biography. Scroll to Contact with the keyboard open; verify Name → Email → Message focus and first-tap button handling.
- Empty/invalid fields show helpful errors; valid drafts open the email app with the specified recipient and encoded name/reply email/message. Review without sending unless deliberately testing delivery yourself. Failure/no email handler preserves the draft and shows a selectable address; no false delivered message.
- Expand Qwen → Censored. Qwen 3.5 0.8B alone shows Preferred, even before loading; Selected still appears only for an actually loaded model. No provider starts auto-expanded.

## Post-0.5.5 Dev regression checks

- During a long streaming answer, drag up just a little while still near the bottom; keep reading and verify no snap down, including after finger release/momentum.
- Touch the transcript before dragging; incoming tokens should not move it during the interaction.
- Scroll well up, open/close the keyboard and wait for the reply to finish: the app should respect reading position. Scroll down to the bottom to resume following.
- Send a message and immediately scroll up before the next frame; no later scheduled frame should override the newer gesture.
- With Web enabled, ask a factual question: expect a short direct answer, no source-by-source explanation/inline link numbering, and accessible source links below.

These checks apply to source/Dev changes after standalone 0.5.5 was built.

- Post-0.5.5 Dev voice: pause in silence/noise then speak; `[BLANK_AUDIO]` and silence markers must never appear. Dictate continuously and check words update as decoding completes, Stop flushes the tail, Cancel preserves typed text, and no text leaks to a different chat. Minimum audio buffering and phone compute latency still apply.

## 0.5.6 synchronized production acceptance

- Install over existing PhoneGPT without uninstalling; verify chats, model files and saved settings remain.
- Appearance: choose each color, toggle dark mode, check labels/bubbles, then restart and verify persistence.
- Airplane mode: cold-start app and chat/voice with downloaded models; web search should fail clearly without blocking local chat when disabled.
- Online optional Web: verify one-time disclosure, Searching state, direct answer, separate source cards and context usage; existing shared pilot quota still applies.
- Test new compact models, context 10k/20k only as phone RAM permits; reduce if load fails.
- During streaming scroll upward slightly and stay there; send a new message to resume following. Test Stop and draft typing.
- Voice: speech/silence/speech must not insert BLANK_AUDIO; Stop flushes tail without duplicate text.
- Export selected/all chats to a selectable Android subfolder and inspect ZIP.
