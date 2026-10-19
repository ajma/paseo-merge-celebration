export function useHosts() {
  return [];
}
export function useRpc() {
  return async () => ({ events: [] });
}
import { useSyncExternalStore } from "react";
import { defaultSettings, type CelebrationSettings } from "../../shared/settings";

let settings = defaultSettings;
let ready = !new URLSearchParams(location.search).has("settings-loading");
const listeners = new Set<() => void>();
/** Stands in for saved host settings; the Bridge reads them through useSettings. */
export function setTestSettings(next: Partial<CelebrationSettings>) {
  ready = true;
  settings = { ...settings, ...next };
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useSettings() {
  const values = useSyncExternalStore(subscribe, () => settings);
  return {
    status: ready ? "ready" : "loading",
    values,
    revision: "test",
    saving: false,
  };
}
