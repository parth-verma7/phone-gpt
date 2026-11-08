# Saved prompt history — EGM review

Date: 2026-11-09. A single fresh-context subagent read Google's EGM Codebase Details persona and reviewed the feature specification against source. This used downloaded reviewer guidance, not an installed plugin or the full EGM multi-round workflow. No claim of convergence or native-device acceptance.

## Findings and resolution

- **Blocker: legacy JSON prompt collision.** Fixed with a separate versioned storage key and raw-text fallback. Regression covers JSON containing schemaVersion.
- **Blocker: installation-only privacy claim.** Corrected documentation: Android backup is enabled; OS backup may retain/restore data. This feature adds no network service.
- **Major: unbounded history shares chat storage.** Added limits of 50 entries, 64,000 combined text characters and 16,000 characters per prompt. Full history rejects a save; confirmed removal frees space without changing active instructions. No automatic pruning.
- **Major: load failure silently blocks existing chat.** Existing chat snapshots remain usable. New chat attempts show a clear alert; writes remain disabled to protect unread history. Restart retries loading.

The reviewer found no demonstrated overlapping-save history loss in the current single-hook wiring. The guard is local to that hook, not a cross-process lock. Implementation fixes were validated with TypeScript and regression tests; they have not received a second fresh-context review. Native A54 checks remain pending.

Useful EGM commands: egm-brainstorm, egm-draft, egm-review, egm-review-loop. Command prefixes vary by host; Codex selects installed skills. Full plugin installation is not verified in this session.
