# Setup and development

Fullscreen confetti over the current Paseo desktop/browser window when an archived workspace's GitHub PR has merged. Includes a dismiss button, linked issue recaps, reduced-motion support and **Preview merge celebration** in the Command Center. The current screen stays mounted and usable.

This version runs on **stock Paseo 0.11.2**. It needs no app patch, app rebuild or daemon restart. The earlier patch-dependent implementation has been replaced.

## Requirements and installation

- Paseo 0.11.2 desktop or browser client and daemon. The manifest pins the tested version.
- Git and an authenticated GitHub CLI (`gh`) on the daemon host's PATH, with access to the repository and linked issues. GitHub.com repositories only.
- Native iOS/Android clients contribute no celebration UI. Desktop/browser layouts were tested on macOS Chrome; Windows/Linux desktop testing remains pending.

```sh
npm ci --ignore-scripts
npm run typecheck
paseo plugin install /absolute/path/to/paseo-merge-celebration
paseo plugin ls
paseo plugin logs paseo-merge-celebration
```

Open **⌘K** on macOS or **Ctrl+K** on Windows/Linux and choose **Preview merge celebration**. Preview stays local and never archives anything or calls GitHub.

Before installation, check the target daemon's root `pluginsEnabled` field in its `config.json`. A missing or false value requires explicit permission before enabling trusted, unsandboxed plugins. The local daemon's switch was already true. Reload source changes with `paseo plugin reload paseo-merge-celebration`; do not restart the daemon.

## Fullscreen without changing Paseo

Paseo's [documented client API](https://paseo.sh/docs/plugins/reference) has screens and modals, but no portable global overlay contribution. Its client module loader supplies the existing React Native runtime to trusted plugin code.

The plugin uses the public React Native Web [AppRegistry](https://necolas.github.io/react-native-web/docs/app-registry/) to mount its React Native component into a plugin-owned fixed browser root. Browser drawing is confined to `client/web.ts` and `client/confetti.web.tsx`, reached only behind the `Platform.OS === "web"` entry guard. No private Paseo modules, React DOM imports, app files or app routes are used. Teardown unmounts the component and removes the root. Native clients return a no-op before mounting or registering UI.

The confetti uses a small fixed-step particle simulation and one transparent Canvas 2D layer. Each sheet enters from above, accelerates under gravity, settles against quadratic air resistance, and drifts with varying wind and flutter. Individual rotation, projected face turns and darker reverse sides create paper-like tumbling. Particle count is capped and stalled frames cannot emit a backlog or teleport existing pieces. Frames draw directly to the canvas without updating React state.

Dismissal stops emission immediately and lets existing pieces leave the viewport before the drawing loop and canvas are removed. Reduced motion, hiding the window, reconnecting and plugin unload cancel the old animation immediately. The same active celebration starts a fresh shower when its window becomes visible again; reconnecting cancels the current animation and recovers any event that has not yet been displayed.

This is a browser-specific integration rather than a Paseo global-overlay contract. The root and decorative animation pass pointer events through; only the recap controls and scrolling capture input. Reduced-motion preferences remove the falling confetti. Fresh confetti enters continuously while the recap is open. The recap stays until dismissed or the connection resets. A celebration received while the same connected window is hidden waits for visibility before animating; the confetti resumes when the same connected window becomes visible again. Colors use Paseo theme tokens received through an invisible sidebar contribution; an OS-theme palette supplies readable defaults before that contribution mounts. Automatic delivery starts once saved settings load through the sidebar contribution or settings screen. If that contribution is hidden before settings load, open the settings screen to initialize delivery; local preview remains available.

## Settings

`shared/settings.ts` defines one host-scoped settings document with the [settings API](https://paseo.sh/docs/plugins/reference#settings-screens). The server registers it, and `client/settings.tsx` contributes **Settings → Plugins → Merge celebration** using Paseo's named settings components. Each control saves the complete document immediately, with the loaded revision. The schema supplies defaults, so a missing document gives the original celebration: "Work shipped! 🎉", issue recap and confetti on, and medium size, normal speed and normal amount.

The overlay is mounted outside Paseo's component tree, so it cannot call `useSettings` itself. The invisible sidebar footer item that already forwards the theme also forwards the saved settings into the presentation store, and the settings screen does the same while it is open. Automatic delivery waits for settings readiness, so hiding that sidebar item before initialization requires opening the settings screen once. Turning off **Celebrate merged work** drops live events on the client; Command Center and settings previews still show.

Confetti options are plain multipliers passed to the simulation. Size scales sheets as they are born. Speed scales simulated time, so falling, spinning and emission all speed up or slow down together, and density stays the same. Amount scales both the birth rate and the particle cap. Speed and amount apply to a running shower immediately; size applies to new sheets.

## Archive and delivery behavior

Current docs and source were inspected at Paseo commit `f56c0139283028ea8b62e9ce40c1fcccad7b3efb`:

- [`workspace.archived`](https://github.com/getpaseo/paseo/blob/f56c0139283028ea8b62e9ce40c1fcccad7b3efb/packages/plugin/src/server/lifecycle.ts) supplies identity and an archive timestamp, but no archive reason or PR state.
- [Archive cleanup](https://github.com/getpaseo/paseo/blob/f56c0139283028ea8b62e9ce40c1fcccad7b3efb/packages/server/src/server/workspace-archive-service.ts) can race plugin hooks. [Worktree removal](https://github.com/getpaseo/paseo/blob/f56c0139283028ea8b62e9ce40c1fcccad7b3efb/packages/server/src/utils/worktree.ts) retains the local branch in the main repository.

Before accepting a live client, the server observes workspace descriptors and captures missing Git identity. It also observes workspace creation. The archive callback reads `refs/heads/<branch>` from the surviving main repository, rather than launching `gh` in a removed worktree. It checks the known PR or GitHub's [PRs associated with that exact commit](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit), requires an identical PR head SHA, and requires `MERGED` with `mergedAt <= archivedAt`. A manual archive of already merged work qualifies; an archive of open work does not. A later merge cannot celebrate an earlier archive.

Up to three GitHub closing issues get a 300-character plain text excerpt. Missing issue bodies fall back to issue titles. If an issue cannot be fetched, a numbered placeholder preserves the verified merge celebration. The PR title describes the shipped change. No model is called and Markdown/HTML is not executed.

Typed RPC polls once per second. The server retains up to 100 verified celebrations in memory for 24 hours, even when no client is polling. Client leases still expire after four seconds for diagnostics, but no longer control archive eligibility or event retention. Each connection receives pending events once; a restored baseline offers unacknowledged events again. A visible overlay acknowledges its event through `celebrations.presented`, removing it from the server queue. Clients retry failed acknowledgements before polling, including after reconnect. The acknowledgement confirms a visible component, not that someone looked at it. Once any window acknowledges an event, newly connected windows do not receive it.

An owned workspace subscription resets the client baseline whenever a fresh connection snapshot arrives. A poll requires the same non-null subscription ID before and after its RPC, so responses from old connections cannot reach the UI. Received events wait in order for dismissal. On reset, undisplayed events become eligible for recovery; displayed or dismissed IDs remain suppressed. Hidden windows wait for visibility before acknowledging. Turning celebrations off consumes events without displaying them. Pending events and acknowledgement state are not persisted across plugin reload or daemon restart. If a client reloads while a presentation acknowledgement is failing, its local retry state is lost and the server can offer the event again.

Unknown identity, detached checkouts, inaccessible repositories, deleted branch refs and GitHub lookup failures stay silent and log a diagnostic. Custom teardown that deletes the main repository or branch is unsupported. Identity must have been observed through a previous client connection or workspace creation before archive.

Logs distinguish an observed archive, its merge decision, publication, delivery, and a visible overlay's acknowledgement. The diagnostic RPC `celebrations.diagnose` accepts `{ preview: false }` to report the live client count, or `{ preview: true }` to queue a labeled preview without archiving anything. Ordinary Command Center preview remains local.

## Verification

```sh
npm run typecheck
npm test
npm run test:ui
npm run preview
```

Browser tests require Chrome. They use the actual client entry and React Native Web, with a host exposing only stock plugin registrations. They exercise preview, saved settings, full-viewport bounds, issue recaps, continued typing/clicking, theme changes, reduced motion, dismissal, repeat preview and plugin unload. Screenshots are in `artifacts/`.

The actual archive-hook test uses a prepared Paseo source checkout (`npm ci`, `npm run build:app-deps`):

```sh
PASEO_SOURCE=/absolute/path/to/paseo npm run test:archive
```

It temporarily adds a test fixture to the existing server test suite, starts a disposable daemon on a random port, installs the plugin, and archives temporary Git workspaces. GitHub responses use a deterministic test-only executable; no remote PR is created or merged. It verifies both manual archival and automatic archival through Paseo's real auto-archive controller, driven by synthetic open-to-merged forge snapshots. An additional automatic-archive case waits for all client leases to expire before the merge, then reconnects and verifies delivery. These paths exercise registry mutation, lifecycle delivery, managed worktree cleanup, the actual client subscription and its celebration store. It also covers diagnostic previews, duplicates, reloads, new connections, an open PR and a GitHub failure. A separate test deletes a real worktree before merge lookup.

See [verification evidence](artifacts/verification.md) for recorded results and platform limits.

The public README uses a staged screenshot with fictional workspace content and the actual overlay component. Regenerate it with `npm run screenshot`; its sources live in `tests/browser/marketing.html` and `tests/browser/marketing.tsx`.
