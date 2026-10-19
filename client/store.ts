import { MAX_PENDING, RETENTION_MS, type Celebration } from "../shared/celebration";
export function createCelebrationStore(now = Date.now) {
  let current: Celebration | null = null;
  let motionGeneration = 0;
  const listeners = new Set<() => void>();
  const seen = new Set<string>();
  const presented = new Set<string>();
  const acknowledgements = new Set<string>();
  const queue: Celebration[] = [];
  function publish() {
    for (const listener of listeners) listener();
  }
  function prune() {
    const expired = (event: Celebration) =>
      event.expiresAt !== undefined && event.expiresAt <= now();
    for (let i = queue.length - 1; i >= 0; i--) {
      if (expired(queue[i])) queue.splice(i, 1);
    }
    if (current && !presented.has(current.id) && expired(current)) {
      current = queue.shift() ?? null;
      publish();
    }
  }
  return {
    prune,
    getSnapshot: () => current,
    getMotionGeneration: () => motionGeneration,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    show(event: Celebration) {
      prune();
      if ((event.expiresAt ?? Infinity) <= now()) return;
      event = { ...event, expiresAt: event.expiresAt ?? now() + RETENTION_MS };
      if (seen.has(event.id)) return;
      seen.add(event.id);
      if (current) {
        if (queue.length >= MAX_PENDING - 1) queue.shift();
        queue.push(event);
      } else current = event;
      publish();
    },
    presented(id: string) {
      presented.add(id);
      acknowledgements.add(id);
    },
    pendingAcknowledgements: () => [...acknowledgements],
    acknowledged(id: string) {
      acknowledgements.delete(id);
    },
    dismiss() {
      if (current) {
        presented.add(current.id);
        acknowledgements.add(current.id);
      }
      current = queue.shift() ?? null;
      prune();
      publish();
    },
    cancel() {
      for (const event of current ? [current, ...queue] : queue) {
        if (!presented.has(event.id)) seen.delete(event.id);
      }
      queue.length = 0;
      current = null;
      motionGeneration += 1;
      publish();
    },
    clear() {
      current = null;
      motionGeneration += 1;
      queue.length = 0;
      seen.clear();
      presented.clear();
      acknowledgements.clear();
      publish();
      listeners.clear();
    },
  };
}
export type CelebrationStore = ReturnType<typeof createCelebrationStore>;
