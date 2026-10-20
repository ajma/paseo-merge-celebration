import type { PluginHookContext, PluginServerContext } from "@getpaseo/plugin/server";
import {
  diagnoseCelebration,
  pollCelebrations,
  previewCelebration,
  reportCelebration,
} from "../shared/celebration";
import { celebrationSettings } from "../shared/settings";
import { createBroker } from "./broker";
import {
  captureDirectory,
  identify,
  resolveCelebration,
  type Identity,
  type Workspace,
} from "./github";

export function contributeServer(server: PluginServerContext) {
  server.registerSettings(celebrationSettings);
  const lifetime = new AbortController();
  const broker = createBroker();
  const identities = new Map<string, Identity>();
  const handled = new Set<string>();
  const checking = new Set<string>();
  const releases: (() => void)[] = [];
  let observation: Promise<void> | null = null;
  let initialized = false;

  function remember(workspace: Workspace, baseline = false) {
    const identity = identify(workspace);
    if (identity) identities.set(workspace.id, identity);
    const pr = workspace.githubRuntime?.pullRequest;
    if (!pr?.isMerged || (workspace.forge && workspace.forge !== "github")) return;
    const key = `${workspace.id}:${pr.url}`;
    // Existing merged PRs are history, rather than new merges to celebrate on reload.
    if (baseline) handled.add(key);
    if (handled.has(key) || checking.has(key) || lifetime.signal.aborted) return;
    checking.add(key);
    void (async () => {
      const identity = identities.get(workspace.id) ??
        await captureDirectory(
          workspace.workspaceDirectory ?? workspace.project?.checkout.cwd ?? workspace.projectRootPath,
          lifetime.signal,
        );
      if (!identity) return;
      const event = await resolveCelebration({
        workspace,
        identity,
        signal: lifetime.signal,
      });
      if (event && event.url === pr.url && !lifetime.signal.aborted) {
        handled.add(key);
        broker.publish(event);
        console.info("[merge-celebration] Published", event.id);
      }
    })()
      .catch((error) => {
        if (!lifetime.signal.aborted)
          console.error(
            "[merge-celebration] Merge verification failed",
            workspace.id,
            error instanceof Error ? error.message : String(error),
          );
      })
      .finally(() => checking.delete(key));
  }

  function observe(paseo: PluginHookContext["paseo"]) {
    if (observation) return observation;
    observation = (async () => {
      let cursor: string | undefined;
      do {
        const result = await paseo.workspaces.list({
          subscribe: {},
          page: { limit: 200, cursor },
        });
        if (lifetime.signal.aborted) {
          result.subscription.release();
          return;
        }
        for (const workspace of result.entries) remember(workspace, !initialized);
        result.subscription.subscribe({
          snapshot: ({ entries }) => {
            for (const workspace of entries) remember(workspace);
          },
          update: (message) => {
            if (message.type === "workspace_update" && message.payload.kind === "upsert")
              remember(message.payload.workspace);
          },
          error: () => {
            // The next client poll reopens a terminally failed observation.
            for (const release of releases.splice(0)) release();
            observation = null;
          },
        });
        releases.push(() => result.subscription.release());
        cursor = result.pageInfo.nextCursor ?? undefined;
      } while (cursor);
      initialized = true;
    })().catch((error) => {
      for (const release of releases.splice(0)) release();
      observation = null;
      throw error;
    });
    return observation;
  }
  server.handle(pollCelebrations, async (input, { paseo }) => {
    await observe(paseo);
    if (input.baseline) console.info("[merge-celebration] Desktop/browser client ready");
    return broker.poll(input);
  });
  server.handle(reportCelebration, ({ id }) => {
    broker.presented(id);
    console.info("[merge-celebration] Rendered", id);
    return {};
  });
  server.handle(diagnoseCelebration, ({ preview }) => {
    const audience = broker.audience();
    const previewId = preview ? `diagnostic-preview-${Date.now()}` : null;
    if (previewId) broker.publish({ ...previewCelebration, id: previewId });
    return { clients: audience.size, previewId };
  });
  return () => {
    lifetime.abort();
    for (const release of releases) release();
    broker.clear();
    identities.clear();
    handled.clear();
  };
}
