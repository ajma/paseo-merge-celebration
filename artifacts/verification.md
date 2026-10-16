# Verification evidence

Paseo merge celebration 0.1.0, verified 2026-10-15 on macOS arm64. This is the plugin-only desktop/browser implementation for stock Paseo 0.11.2. The old app patch and its SDK extension have been removed from the deliverable.

| Check                                                 | Result    | Evidence                   |
| ----------------------------------------------------- | --------- | -------------------------- |
| Plugin TypeScript                                     | Passed    | [Output](typecheck.txt)    |
| Core, stream and particle physics                     | 21 passed | [Output](core-tests.txt)   |
| Chrome UI using stock plugin APIs                     | 9 passed  | [Output](ui-tests.txt)     |
| Isolated daemon manual and automatic archive delivery | 2 passed  | [Output](archive-test.txt) |

Core tests cover exact commit/merge matching, unmerged and later-merged archives, issue excerpts, duplicate suppression, mailbox expiry, RPC failures, restored connections, delayed restoration, stale in-flight replies and terminal watcher recovery. A real worktree is deleted before lookup to verify the surviving branch strategy.

The issue parser fix addresses a confirmed production archive failure: `gh pr view` returns closing-issue references without titles, but the previous parser required a title and aborted delivery. Regression tests first reproduced that error and now cover the real response shape and an inaccessible issue. Issue details are fetched separately; a failed issue lookup produces a numbered placeholder without blocking the celebration. The isolated daemon archive test also includes a title-free closing-issue reference and verifies its fetched recap.

A read-only lookup of the missed PR #6473 in `noosphereai/noosphere` successfully produced a verified celebration and issue #6470's recap using the real GitHub CLI, after confirming the original worktree no longer existed. This check did not publish or replay the missed event to clients.

After a second missed archive (PR #6474), read-only merge lookup succeeded both with and without a cached PR number. The original logs could not distinguish a dropped event from a celebration that had already dismissed. New tracing records archive observation, merge decisions, publication, mailbox delivery, and a visible component's rendering acknowledgement. A disposable managed worktree backed by PR #6474 was created and archived in the existing local daemon; both connected clients acknowledged rendering that new archive. This was a manual test archive using a merged PR, not a new remote merge. No existing workspace or remote PR was changed, and the original missed event was not replayed.

The visibility fix removed a reproduced visibility failure mode: the recap previously disappeared after 16 seconds even while its window was hidden. Browser regressions failed before that fix and verified that the recap stayed until dismissed and a hidden-window event started on visibility. A separate regression first failed and now proves that reconnecting discards a received event waiting for visibility. The user subsequently confirmed Paseo was focused during the #6474 miss and that they saw the disposable archive test. This rules out a hidden window as the explanation for their reported failure; its original cause remains unidentified. The user later confirmed the celebration worked correctly.

The confetti now uses individual simulated sheets instead of a repeating progress pattern. Browser pixel checks verify a blank initial canvas, entry confined to the top edge, continued motion after 17 seconds, immediate reduced-motion changes, and a moving tail that clears completely after dismissal. Dismissal first reproduced a failure because the old renderer removed all pieces immediately. Fixed-step physics tests cover gravity and terminal speed, varied tumbling, no upward wrapping, a bounded particle count, matching motion at 30 and 120 FPS, capped recovery after a stalled frame, and stopping new births while existing particles leave the viewport. A review found that a fixed birth rate could saturate the particle cap on tall windows; emission now accounts for conservative transit time. A regression failed before that fix and now verifies fresh births every quarter-second for 25 seconds at 2560×1440 and 3840×2160, while staying below the cap. Review follow-up found no remaining material issues. Reconnect cancellation is tested separately from graceful dismissal. The marketing screenshot uses fictional workspace content and the actual current overlay. Its slate palette, sidebar navigation and workspace groups, tabs and composer were rebuilt using the user’s reference as visual guidance; the reference image itself and its private conversation content were not reused.

The integration suite now tests manual and automatic archival separately. The automatic case drives synthetic open-to-merged forge snapshots into the real daemon's auto-archive controller, including its fresh-snapshot check; registry mutation, lifecycle dispatch, cleanup, RPC and client subscription/store remain real. Both pass. Source inspection of the app's plugin registry and catalog synchronization found no dependency on the selected workspace or route: ordinary workspace navigation preserves the installed plugin runtime. There was no production fix for the unexplained original event in this follow-up, and no app modification or daemon restart.

Browser tests run the actual client entry with a host exposing only stock registration APIs. There is no `addOverlay` method. The plugin mounts a separate React Native Web root through the host renderer. Tests verify full-viewport bounds, continued typing and clicking, theme changes, issue recap, dismissal, repeat preview and complete root removal on plugin unload. Motion and reduced-motion cases pass at both 1280×800 and 390×844.

- [Wide, animation](preview-wide-motion.png)
- [Wide, reduced motion](preview-wide-reduced.png)
- [Compact, animation](preview-compact-motion.png)
- [Compact, reduced motion](preview-compact-reduced.png)

The screenshots show a test host underneath the actual plugin UI. The browser host stubs Paseo connectivity; the archive test separately installs the exact plugin into a disposable real daemon on a random port and invokes actual managed worktree create/archive operations. It now runs the actual client subscription and celebration store as well as checking raw RPC mailboxes. Only GitHub responses are fixtures. It verifies archive-hook/client delivery, diagnostic previews, duplicates, a fresh connection, plugin reload, an open PR and a GitHub failure without crashing the plugin. No user workspace or remote PR is changed by the isolated tests.

A read-only code review found a reconnect race in snapshot-only invalidation. A regression test reproduced it. The fix now requires the same non-null public subscription ID before and after RPC, alongside snapshot generation checks. Review follow-up found no remaining material issues.

Native iOS/Android clients are deliberately a no-op. Other desktop operating systems and packaged-app visual inspection remain unverified. Browser rendering is a plugin-owned web integration, not a portable Paseo overlay contribution.

The plugin is now installed in the regular local daemon and reports **running**. The global plugin switch was already true. Logs confirm desktop/browser clients established live observations after installation. The daemon retains PID 9903 and its original `2026-10-09T19:35:28.366Z` start time; no app bundle was edited or rebuilt and no daemon restart occurred.

- [Installed plugin](installed-plugin.json)
- [Client-ready and server logs](installed-plugin-logs.json)
- [Unchanged daemon process](daemon-state.json)
