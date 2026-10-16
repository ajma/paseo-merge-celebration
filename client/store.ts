import type { Celebration } from "../shared/celebration";
export function createCelebrationStore() {
  let current: Celebration | null = null;
  let motionGeneration = 0;
  const listeners = new Set<() => void>();
  const seen = new Set<string>();
  function publish() {
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => current,
    getMotionGeneration: () => motionGeneration,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    show(event: Celebration) {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      current = event;
      publish();
    },
    dismiss() {
      current = null;
      publish();
    },
    cancel() {
      current = null;
      motionGeneration += 1;
      publish();
    },
    clear() {
      current = null;
      motionGeneration += 1;
      seen.clear();
      publish();
      listeners.clear();
    },
  };
}
export type CelebrationStore = ReturnType<typeof createCelebrationStore>;
