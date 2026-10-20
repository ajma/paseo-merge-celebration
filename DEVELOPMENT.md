# Setup and development

Fullscreen confetti over the current Paseo desktop/browser window when Paseo detects a workspace's GitHub PR merge. Includes Dismiss and Archive workspace buttons, linked issue recaps, reduced-motion support and **Preview merge celebration** in the Command Center. The current screen stays mounted and usable.

This version supports **stock Paseo 0.11.2 through 0.12.x**, including a 0.12.0 app connected to a 0.11.2 daemon. It needs no app patch, app rebuild or daemon restart. The earlier patch-dependent implementation has been replaced.

## Requirements and installation

- Paseo 0.11.2 through 0.12.x desktop or browser client and daemon. The manifest permits both versions independently, so a 0.12.0 client can load the plugin from a 0.11.2 daemon.
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

## Merge detection and delivery behavior

Before accepting a live client, the server observes workspace descriptors through an owned SDK workspace subscription. Existing merged PRs in the initial list are treated as history, so connecting or reloading does not celebrate old work. Later snapshots and upserts whose GitHub PR has `isMerged` trigger verification. Detection follows Paseo's GitHub status refresh cadence; no archive hook is required.

The server captures repository and branch identity from descriptors, falling back to Git when needed. It reads `refs/heads/<branch>` from the main repository, checks the known PR or GitHub's PRs associated with that exact commit, and requires an identical PR head SHA, `MERGED` state and a merge timestamp. Updates are deduplicated by workspace and PR URL, including after presentation. Failed checks can retry on later descriptor updates. Subscription observation continues after client leases expire, so a detected merge can wait for a client to reconnect.

The recap offers **Dismiss**, which closes the celebration and keeps the workspace, and **Archive workspace**, which calls the selected host's normal `paseo.workspaces.archive(workspaceId)` SDK method. Archive requests disable the archive button while pending. A failed request shows an error and leaves both dismissal and retry available. Success dismisses only the originating celebration, so a later queued recap stays open. Previews carry no workspace ID and show a disabled Archive workspace button that cannot call the archive API. If a descriptor already has `archivingAt`, its celebration disables the archive action. Paseo's own automatic archival setting still applies; disable it to choose archival from this dialog.

Up to three GitHub closing issues get a 300-character plain text excerpt. Missing issue bodies fall back to issue titles. If an issue cannot be fetched, a numbered placeholder preserves the verified merge celebration. The PR title describes the shipped change. No model is called and Markdown/HTML is not executed.

Typed RPC polls once per second. The server retains up to 100 verified celebrations in memory for 24 hours, even when no client is polling. Client leases still expire after four seconds for diagnostics, but do not control merge eligibility or event retention. Each connection receives pending events once; a restored baseline offers unacknowledged events again. A visible overlay acknowledges its event through `celebrations.presented`, removing it from the server queue. Clients retry failed acknowledgements before polling, including after reconnect. The acknowledgement confirms a visible component, not that someone looked at it. Once any window acknowledges an event, newly connected windows do not receive it.

An owned workspace subscription resets the client baseline whenever a fresh connection snapshot arrives. A poll requires the same non-null subscription ID before and after its RPC, so responses from old connections cannot reach the UI. Received events wait in order for dismissal. On reset, undisplayed events become eligible for recovery; displayed or dismissed IDs remain suppressed. Hidden windows wait for visibility before acknowledging. Turning celebrations off consumes events without displaying them. Pending events and acknowledgement state are not persisted across plugin reload or daemon restart. If a client reloads while a presentation acknowledgement is failing, its local retry state is lost and the server can offer the event again.

Unknown identity, detached checkouts, inaccessible repositories, deleted branch refs and GitHub lookup failures stay silent and log a diagnostic. Custom teardown that deletes the main repository or branch is unsupported. Observation starts with the first celebration poll and continues until plugin teardown.

Logs distinguish merge verification failures, publication and a visible overlay's acknowledgement. The diagnostic RPC `celebrations.diagnose` accepts `{ preview: false }` to report the live client count, or `{ preview: true }` to queue a labeled preview without archiving anything. Ordinary Command Center preview remains local.

## Verification

```sh
npm run typecheck
npm test
npm run test:ui
npm run preview
```

Browser tests require Chrome. They use the actual client entry and React Native Web, with a host exposing only stock plugin registrations. They exercise preview, saved settings, full-viewport bounds, issue recaps, continued typing/clicking, theme changes, reduced motion, dismissal, repeat preview and plugin unload. Screenshots are in `artifacts/`.

The daemon integration test uses a prepared Paseo source checkout (`npm ci`, `npm run build:app-deps`):

```sh
PASEO_SOURCE=/absolute/path/to/paseo npm run test:archive
```

It temporarily adds a test fixture to the existing server test suite, starts a disposable daemon on a random port, installs the plugin, and watches a temporary Git workspace. GitHub responses use a deterministic test-only executable; no remote PR is created or merged. Synthetic open-to-merged forge snapshots exercise the actual workspace observation, RPC delivery and celebration store, with automatic archival disabled. The test checks that the workspace remains active until explicitly archived through the SDK. The ordinary test suite also checks duplicate snapshots, historical merges, recovery, verification failure and merge lookup after a real worktree is removed. Browser tests cover separate dismissal and archive actions, compact layouts, archive failures and retries.

See [verification evidence](artifacts/verification.md) for recorded results and platform limits.

The public README uses a staged screenshot with fictional workspace content and the actual overlay component. Regenerate it with `npm run screenshot`; its sources live in `tests/browser/marketing.html` and `tests/browser/marketing.tsx`.
