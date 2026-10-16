import type { PluginHookContext, PluginServerContext } from "@getpaseo/plugin/server";
import { pollCelebrations } from "../shared/celebration";
import { createBroker } from "./broker";
import { captureDirectory, identify, resolveCelebration, type Identity } from "./github";
export function contributeServer(server: PluginServerContext) {
  const lifetime = new AbortController();
  const startedAt = Date.now();
  const broker = createBroker();
  const identities = new Map<string, Promise<Identity | null>>();
  const handled = new Set<string>();
  const releases: (() => void)[] = [];
  let observation: Promise<void> | null = null;
  function observe(paseo: PluginHookContext["paseo"]) {
    if (observation) return observation;
    observation = (async () => {
      let cursor: string | undefined;
      do {
        const result = await paseo.workspaces.list({ subscribe: {}, page: { limit: 200, cursor } });
        if (lifetime.signal.aborted) {
          result.subscription.release();
          return;
        }
        function remember(workspace: (typeof result.entries)[number]) {
          const identity = identify(workspace);
          const directory =
            workspace.workspaceDirectory ??
            workspace.project?.checkout.cwd ??
            workspace.projectRootPath;
          const pending = identity
            ? Promise.resolve(identity)
            : captureDirectory(directory, lifetime.signal);
          identities.set(workspace.id, pending);
          return pending;
        }
        // Establish identity before allowing this client to join the live audience.
        for (const workspace of result.entries) await remember(workspace);
        result.subscription.subscribe({
          snapshot: ({ entries }) => {
            for (const workspace of entries) void remember(workspace);
          },
          update: (message) => {
            if (message.type === "workspace_update" && message.payload.kind === "upsert")
              void remember(message.payload.workspace);
          },
        });
        releases.push(() => result.subscription.release());
        cursor = result.pageInfo.nextCursor ?? undefined;
      } while (cursor);
    })().catch((error) => {
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
  const removeCreated = server.on("workspace.created", ({ workspace }) => {
    const pending = captureDirectory(workspace.cwd, lifetime.signal);
    identities.set(workspace.id, pending);
    void pending.catch(() => {});
  });
  const removeArchive = server.on("workspace.archived", async ({ workspace }, { signal }) => {
    if (
      lifetime.signal.aborted ||
      !workspace.archivedAt ||
      Date.parse(workspace.archivedAt) < startedAt ||
      handled.has(workspace.id)
    )
      return;
    handled.add(workspace.id);
    const audience = broker.audience();
    const pending = identities.get(workspace.id);
    identities.delete(workspace.id);
    if (audience.size === 0) return;
    try {
      const identity = await pending;
      if (!identity) {
        console.warn(
          "[merge-celebration] Skipping archive without observed GitHub branch identity",
          workspace.id,
        );
        return;
      }
      const event = await resolveCelebration({ workspace, identity, signal: lifetime.signal });
      if (event && !lifetime.signal.aborted) broker.publish(event, audience);
    } catch (error) {
      if (!signal.aborted && !lifetime.signal.aborted)
        console.error(
          "[merge-celebration] Merge verification failed",
          workspace.id,
          error instanceof Error ? error.message : String(error),
        );
    }
  });
  return () => {
    lifetime.abort();
    removeCreated();
    removeArchive();
    for (const release of releases) release();
    broker.clear();
    identities.clear();
  };
}
