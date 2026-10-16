# Verification evidence

Paseo merge celebration 0.2.1, verified 2026-10-15 on macOS arm64. This is the plugin-only desktop/browser implementation for stock Paseo 0.11.2. The old app patch and its SDK extension have been removed from the deliverable.

| Check | Result | Evidence |
| --- | --- | --- |
| Plugin TypeScript | Passed | [Output](typecheck.txt) |
| Core and client stream behavior | 14 passed | [Output](core-tests.txt) |
| Chrome UI using stock plugin APIs | 4 passed | [Output](ui-tests.txt) |
| Isolated daemon archive hook and RPC | 1 passed | [Output](archive-test.txt) |

Core tests cover exact commit/merge matching, unmerged and later-merged archives, issue excerpts, duplicate suppression, mailbox expiry, RPC failures, restored connections, delayed restoration, stale in-flight replies and terminal watcher recovery. A real worktree is deleted before lookup to verify the surviving branch strategy.

Version 0.2.1 fixes a confirmed production archive failure: `gh pr view` returns closing-issue references without titles, but the previous parser required a title and aborted delivery. Regression tests first reproduced that error and now cover the real response shape and an inaccessible issue. Issue details are fetched separately; a failed issue lookup produces a numbered placeholder without blocking the celebration. The isolated daemon archive test also includes a title-free closing-issue reference and verifies its fetched recap.

A read-only lookup of the missed PR #6473 in `noosphereai/noosphere` successfully produced a verified celebration and issue #6470's recap using the real GitHub CLI, after confirming the original worktree no longer existed. This check did not publish or replay the missed event to clients.

Browser tests run the actual client entry with a host exposing only stock registration APIs. There is no `addOverlay` method. The plugin mounts a separate React Native Web root through the host renderer. Tests verify full-viewport bounds, continued typing and clicking, theme changes, issue recap, dismissal, repeat preview and complete root removal on plugin unload. Motion and reduced-motion cases pass at both 1280×800 and 390×844.

- [Wide, animation](preview-wide-motion.png)
- [Wide, reduced motion](preview-wide-reduced.png)
- [Compact, animation](preview-compact-motion.png)
- [Compact, reduced motion](preview-compact-reduced.png)

The screenshots show a test host underneath the actual plugin UI. The browser host stubs Paseo connectivity; the archive test separately installs the exact plugin into a disposable real daemon on a random port and invokes actual workspace create/archive operations. Only GitHub responses are fixtures. It verifies archive-hook/RPC delivery, duplicates, a fresh connection, plugin reload, an open PR and a GitHub failure without crashing the plugin. No user workspace or remote PR is changed.

A read-only code review found a reconnect race in snapshot-only invalidation. A regression test reproduced it. The fix now requires the same non-null public subscription ID before and after RPC, alongside snapshot generation checks. Review follow-up found no remaining material issues.

Native iOS/Android clients are deliberately a no-op. Other desktop operating systems and packaged-app visual inspection remain unverified. Browser rendering is a plugin-owned web integration, not a portable Paseo overlay contribution.

The plugin is now installed in the regular local daemon and reports **running**. The global plugin switch was already true. Logs confirm desktop/browser clients established live observations after installation. The daemon retains PID 9903 and its original `2026-10-09T19:35:28.366Z` start time; no app bundle was edited or rebuilt and no daemon restart occurred.

- [Installed plugin](installed-plugin.json)
- [Client-ready and server logs](installed-plugin-logs.json)
- [Unchanged daemon process](daemon-state.json)
