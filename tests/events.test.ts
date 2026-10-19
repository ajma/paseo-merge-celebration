import { test } from "node:test";
import assert from "node:assert/strict";
import type { PluginClientContext } from "@getpaseo/plugin/client";
import { startLiveEvents, reportPresented } from "../client/events";
import { createCelebrationStore } from "../client/store";
import { createBroker } from "../server/broker";
import { previewCelebration, reportCelebration } from "../shared/celebration";

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function connection() {
  const broker = createBroker();
  let snapshot = () => {};
  let fail = false;
  let subscriptionId: string | null = "epoch-0";
  let epoch = 0;
  let onError = () => {};
  let hold = false;
  let releaseHeld = () => {};
  const boundary = {
    paseo: {
      workspaces: {
        async list() {
          subscriptionId ??= `epoch-${++epoch}`;
          return {
            subscription: {
              get subscriptionId() {
                return subscriptionId;
              },
              subscribe(observer: { snapshot(): void; error?(): void }) {
                snapshot = observer.snapshot;
                onError = observer.error ?? (() => {});
                snapshot();
                return () => {};
              },
              async release() {},
            },
          };
        },
      },
    },
    async rpc(contract: unknown, input: Parameters<typeof broker.poll>[0] & { id?: string }) {
      if (fail) {
        fail = false;
        throw new Error("Disconnected");
      }
      if (contract === reportCelebration) {
        broker.presented(input.id!);
        return {};
      }
      const response = broker.poll(input);
      if (hold) {
        hold = false;
        return new Promise<typeof response>((resolve) => {
          releaseHeld = () => resolve(response);
        });
      }
      return response;
    },
  };
  return {
    client: boundary as unknown as Pick<PluginClientContext, "paseo" | "rpc">,
    broker,
    restore: () => {
      subscriptionId = `epoch-${++epoch}`;
      snapshot();
    },
    disconnect: () => {
      subscriptionId = null;
    },
    terminate: () => {
      subscriptionId = null;
      onError();
    },
    holdNext: () => {
      hold = true;
    },
    releaseHeld: () => releaseHeld(),
    failNext: () => {
      fail = true;
    },
  };
}
test("client recovers queued events after a restored snapshot", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.broker.publish(previewCelebration);
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
    stream.broker.presented("preview");
    store.dismiss();
    stream.broker.publish({ ...previewCelebration, id: "offline" });
    stream.restore();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "offline");
    stream.broker.presented("offline");
    store.dismiss();
    stream.broker.publish({ ...previewCelebration, id: "new-live" });
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "new-live");
  } finally {
    stop();
  }
});
test("an RPC error recovers its queued event after a fresh baseline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.broker.publish(previewCelebration);
    stream.failNext();
    t.mock.timers.tick(1000);
    await flush();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
  } finally {
    stop();
  }
});
test("a reconnect recovers a received celebration that was waiting for visibility", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.broker.publish(previewCelebration);
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
    stream.restore();
    assert.equal(store.getSnapshot(), null);
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
  } finally {
    stop();
  }
});

test("queued events cannot replay while a reconnect snapshot is delayed", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.broker.publish(previewCelebration);
    stream.disconnect();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot(), null);
    stream.restore();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
  } finally {
    stop();
  }
});

test("an in-flight response from a disconnected subscription is discarded", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.broker.publish(previewCelebration);
    stream.holdNext();
    t.mock.timers.tick(1000);
    await flush();
    stream.disconnect();
    stream.releaseHeld();
    await flush();
    assert.equal(store.getSnapshot(), null);
    stream.restore();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
  } finally {
    stop();
  }
});
test("a terminal watcher error reacquires observation before accepting new live events", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.terminate();
    t.mock.timers.tick(1000);
    await flush();
    t.mock.timers.tick(1000);
    await flush();
    stream.broker.publish(previewCelebration);
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot()?.id, "preview");
  } finally {
    stop();
  }
});

test("a failed presentation acknowledgement retries before reconnect can replay it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = connection();
  const store = createCelebrationStore();
  const stop = startLiveEvents(stream.client, store);
  try {
    await flush();
    stream.broker.publish(previewCelebration);
    t.mock.timers.tick(1000);
    await flush();
    store.presented("preview");
    stream.failNext();
    t.mock.timers.tick(1000);
    await flush();
    stream.restore();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getSnapshot(), null);
    assert.deepEqual(stream.broker.poll({ session: "another-window", baseline: true }).events, []);
  } finally {
    stop();
  }
});

test("presentation is acknowledged immediately without waiting for a polling tick", async () => {
  const stream = connection();
  const store = createCelebrationStore();
  stream.broker.publish(previewCelebration);
  await reportPresented(stream.client, store, "preview");
  store.clear();
  assert.deepEqual(stream.broker.poll({ session: "new-window", baseline: true }).events, []);
});
