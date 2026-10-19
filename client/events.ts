import type { PluginClientContext } from "@getpaseo/plugin/client";
import { pollCelebrations, reportCelebration } from "../shared/celebration";
import type { CelebrationStore } from "./store";

/** Send immediately; failed confirmations remain queued for the polling retry. */
export async function reportPresented(
  client: Pick<PluginClientContext, "rpc">,
  store: CelebrationStore,
  id: string
) {
  store.presented(id);
  try {
    await client.rpc(reportCelebration, { id });
    store.acknowledged(id);
  } catch {
    // The live loop retries without requiring the overlay to mount again.
  }
}

/** A live stream, deliberately uncached. Restored snapshots invalidate in-flight responses. */
export function startLiveEvents(
  client: Pick<PluginClientContext, "paseo" | "rpc">,
  store: CelebrationStore
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let baseline = true;
  let session = "";
  let release = () => {};
  let subscriptionId = (): string | null => null;
  let observationFailed = false;
  function reset() {
    store.cancel();
    generation += 1;
    baseline = true;
    session = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  reset();
  async function poll() {
    if (stopped) return;
    store.prune();
    if (observationFailed) {
      release();
      timer = setTimeout(connect, 1000);
      return;
    }
    const expectedSubscription = subscriptionId();
    if (expectedSubscription === null) {
      reset();
      timer = setTimeout(poll, 1000);
      return;
    }
    const expectedGeneration = generation;
    try {
      // Retry confirmation after failures before asking for recoverable events.
      for (const id of store.pendingAcknowledgements()) {
        await client.rpc(reportCelebration, { id });
        store.acknowledged(id);
      }
      const response = await client.rpc(pollCelebrations, {
        session,
        baseline,
      });
      if (
        !stopped &&
        generation === expectedGeneration &&
        subscriptionId() === expectedSubscription
      ) {
        baseline = false;
        for (const event of response.events) store.show(event);
      } else if (!stopped) reset();
    } catch {
      reset();
    }
    if (!stopped) timer = setTimeout(poll, 1000);
  }
  async function connect() {
    try {
      const { subscription } = await client.paseo.workspaces.list({
        subscribe: {},
        page: { limit: 1 },
      });
      if (stopped) {
        await subscription.release();
        return;
      }
      subscriptionId = () => subscription.subscriptionId;
      observationFailed = false;
      const unsubscribe = subscription.subscribe({
        snapshot: reset,
        update() {},
        error() {
          observationFailed = true;
          reset();
        },
      });
      release = () => {
        unsubscribe();
        void subscription.release().catch(() => {});
      };
      void poll();
    } catch {
      if (!stopped) timer = setTimeout(connect, 1000);
    }
  }
  void connect();
  return () => {
    stopped = true;
    generation += 1;
    clearTimeout(timer);
    release();
  };
}
