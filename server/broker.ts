import { MAX_PENDING, RETENTION_MS, type Celebration } from "../shared/celebration";
const LEASE_MS = 4_000;
interface Session {
  lastPoll: number;
  offered: Set<string>;
}
/** Retain recent merges until a visible client acknowledges them, independently of its lease. */
export function createBroker(now = Date.now) {
  const sessions = new Map<string, Session>();
  const pending = new Map<string, { event: Celebration; expiresAt: number }>();
  function prune() {
    const time = now();
    for (const [id, session] of sessions) {
      if (time - session.lastPoll >= LEASE_MS) sessions.delete(id);
    }
    for (const [id, entry] of pending) {
      if (time >= entry.expiresAt) pending.delete(id);
    }
  }
  return {
    audience() {
      prune();
      return new Map(sessions);
    },
    publish(event: Celebration) {
      prune();
      if (pending.has(event.id)) return;
      const expiresAt = now() + RETENTION_MS;
      pending.set(event.id, { event: { ...event, expiresAt }, expiresAt });
      while (pending.size > MAX_PENDING) pending.delete(pending.keys().next().value!);
    },
    presented(id: string) {
      pending.delete(id);
    },
    poll({ session: id, baseline }: { session: string; baseline: boolean }) {
      prune();
      let session = sessions.get(id);
      if (baseline || !session) {
        session = { lastPoll: now(), offered: new Set() };
        sessions.set(id, session);
      }
      session.lastPoll = now();
      for (const offered of session.offered) {
        if (!pending.has(offered)) session.offered.delete(offered);
      }
      const events: Celebration[] = [];
      for (const [eventId, { event }] of pending) {
        if (session.offered.has(eventId)) continue;
        session.offered.add(eventId);
        events.push(event);
      }
      return { events };
    },
    clear() {
      sessions.clear();
      pending.clear();
    },
  };
}
