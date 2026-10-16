import type { PluginTheme } from "@getpaseo/plugin";
import { Appearance } from "react-native";
import { defaultSettings, type CelebrationSettings } from "../shared/settings";

export function createPresentationStore() {
  const dark = Appearance.getColorScheme() === "dark";
  let theme: PluginTheme = {
    colors: {
      surface0: dark ? "#18181b" : "#fafafa",
      surface1: dark ? "#27272a" : "#ffffff",
      surface2: dark ? "#3f3f46" : "#e4e4e7",
      border: dark ? "#52525b" : "#a1a1aa",
      foreground: dark ? "#fafafa" : "#18181b",
      foregroundMuted: dark ? "#d4d4d8" : "#52525b",
      accent: "#8257e5",
      accentForeground: "#ffffff",
      statusSuccess: dark ? "#50dfb1" : "#137a58",
      statusWarning: "#ffc857",
      statusDanger: "#ff578f",
    },
  };
  let settings = defaultSettings;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => theme,
    getSettings: () => settings,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(next: PluginTheme) {
      theme = next;
      for (const listener of listeners) listener();
    },
    updateSettings(next: CelebrationSettings) {
      settings = next;
      for (const listener of listeners) listener();
    },
  };
}
export type PresentationStore = ReturnType<typeof createPresentationStore>;
