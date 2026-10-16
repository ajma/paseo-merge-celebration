# Paseo merge celebration

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

The plugin uses the public React Native Web [AppRegistry](https://necolas.github.io/react-native-web/docs/app-registry/) to mount its React Native component into a plugin-owned fixed browser root. Only `client/web.ts` accesses the DOM, guarded by `Platform.OS === "web"`. No private Paseo modules, React DOM imports, app files or app routes are used. Teardown unmounts the component and removes the root. Native clients return a no-op before mounting or registering UI.

This is a browser-specific integration rather than a Paseo global-overlay contract. The root and decorative animation pass pointer events through; only the recap controls and scrolling capture input. Reduced-motion preferences remove the falling confetti. The recap closes after 16 seconds. Colors use Paseo theme tokens received through an invisible sidebar contribution; an OS-theme palette supplies readable defaults before that contribution mounts. Hiding the sidebar contribution affects theme synchronization, not event delivery or preview.

## Archive and delivery behavior

Current docs and source were inspected at Paseo commit `f56c0139283028ea8b62e9ce40c1fcccad7b3efb`:

- [`workspace.archived`](https://github.com/getpaseo/paseo/blob/f56c0139283028ea8b62e9ce40c1fcccad7b3efb/packages/plugin/src/server/lifecycle.ts) supplies identity and an archive timestamp, but no archive reason or PR state.
- [Archive cleanup](https://github.com/getpaseo/paseo/blob/f56c0139283028ea8b62e9ce40c1fcccad7b3efb/packages/server/src/server/workspace-archive-service.ts) can race plugin hooks. [Worktree removal](https://github.com/getpaseo/paseo/blob/f56c0139283028ea8b62e9ce40c1fcccad7b3efb/packages/server/src/utils/worktree.ts) retains the local branch in the main repository.

Before accepting a live client, the server observes workspace descriptors and captures missing Git identity. It also observes workspace creation. The archive callback reads `refs/heads/<branch>` from the surviving main repository, rather than launching `gh` in a removed worktree. It checks the known PR or GitHub's [PRs associated with that exact commit](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit), requires an identical PR head SHA, and requires `MERGED` with `mergedAt <= archivedAt`. A manual archive of already merged work qualifies; an archive of open work does not. A later merge cannot celebrate an earlier archive.

Up to three GitHub closing issues get a 300-character plain text excerpt. Missing issue bodies fall back to issue titles. If an issue cannot be fetched, a numbered placeholder preserves the verified merge celebration. The PR title describes the shipped change. No model is called and Markdown/HTML is not executed.

Typed RPC polls volatile per-client mailboxes once per second. An owned workspace subscription resets the client baseline whenever a fresh connection snapshot arrives. A poll requires the same non-null subscription ID before and after its RPC, so queued responses cannot slip through while restoration is pending. RPC failures also reset the baseline. Mailboxes expire after four seconds without polling. Publication targets the exact mailbox instances present at archive time; replacement connections cannot inherit events from an in-flight lookup. Server workspace IDs and client event IDs suppress duplicates. Nothing is persisted for replay after reload or restart.

Unknown identity, detached checkouts, inaccessible repositories, deleted branch refs and GitHub lookup failures stay silent and log a diagnostic. Custom teardown that deletes the main repository or branch is unsupported. Delivery is best effort for clients actively polling. Background/suspended clients do not accumulate a backlog.

## Verification

```sh
npm run typecheck
npm test
npm run test:ui
npm run preview
```

Browser tests require Chrome. They use the actual client entry and React Native Web, with a host exposing only stock plugin registrations. They exercise preview, full-viewport bounds, issue recaps, continued typing/clicking, theme changes, reduced motion, dismissal, repeat preview and plugin unload. Screenshots are in `artifacts/`.

The actual archive-hook test uses a prepared Paseo source checkout (`npm ci`, `npm run build:app-deps`):

```sh
PASEO_SOURCE=/absolute/path/to/paseo npm run test:archive
```

It temporarily adds a test fixture to the existing server test suite, starts a disposable daemon on a random port, installs the plugin, and archives temporary Git workspaces. GitHub responses use a deterministic test-only executable; no remote PR is created or merged. It verifies real hook/RPC delivery, duplicates, reloads, new connections, an open PR and a GitHub failure. A separate test deletes a real worktree before merge lookup.

See [verification evidence](artifacts/verification.md) for recorded results and platform limits.
