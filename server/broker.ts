import type { Celebration } from "../shared/celebration";
const LEASE_MS = 4_000;
interface Session {
  lastPoll: number;
  events: Celebration[];
}
/** Volatile, leased mailboxes. A new/reconnected client always starts empty. */
export function createBroker(now = Date.now) {
  const sessions = new Map<string, Session>();
  function prune() {
    for (const [id, session] of sessions) {
      if (now() - session.lastPoll >= LEASE_MS) sessions.delete(id);
    }
  }
  return {
    audience() {
      prune();
      return new Map(sessions);
    },
    publish(event: Celebration, audience: Map<string, Session>) {
      prune();
      for (const [id, expected] of audience) {
        const session = sessions.get(id);
        if (session === expected) session.events.push(event);
      }
    },
    poll({ session: id, baseline }: { session: string; baseline: boolean }) {
      prune();
      const session = sessions.get(id);
      if (baseline || !session) {
        sessions.set(id, { lastPoll: now(), events: [] });
        return { events: [] };
      }
      session.lastPoll = now();
      return { events: session.events.splice(0) };
    },
    clear() {
      sessions.clear();
    },
  };
}
