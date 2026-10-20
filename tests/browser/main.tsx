import React, { useState, useMemo, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { Pressable, Text, TextInput, View } from "react-native";
import type { PluginClientContext, PluginHostProps, PluginScreenProps, PluginOpenScreenInput } from "@getpaseo/plugin/client";
import contribute from "../../index.client";
import { createBroker } from "../../server/broker";
import { previewCelebration } from "../../shared/celebration";
import { setTestSettings } from "./host";
let Bridge: ComponentType<PluginHostProps>;
let preview: () => void;
let restoreSnapshot = () => {};
const screens = new Map<string, ComponentType<PluginScreenProps>>();
let showScreen = (_screen: PluginOpenScreenInput) => {};
const broker = createBroker();
const host = { id: "test", label: "Test host" };
const pluginContext = {
  addScreen({ id, Component }: { id: string; Component: ComponentType<PluginScreenProps> }) {
    screens.set(id, Component);
    return () => screens.delete(id);
  },
  openScreen(screen: PluginOpenScreenInput) {
    if (document.body.hasAttribute("data-fail-open-screen")) throw new Error("Could not open workspace.");
    if (!screens.has(screen.screenId)) throw new Error("Unknown screen");
    showScreen(screen);
  },
  addSidebarFooterItem({ Component }: { Component: ComponentType<PluginHostProps> }) {
    Bridge = Component;
    return () => {};
  },
  paseo: {
    workspaces: {
      async archive(workspaceId: string) {
        document.body.setAttribute("data-archive-request", workspaceId);
        const requests = Number(document.body.getAttribute("data-archive-count") ?? 0) + 1;
        document.body.setAttribute("data-archive-count", String(requests));
        if (document.body.hasAttribute("data-delay-archive"))
          await new Promise<void>((resolve) => Object.assign(window, { finishArchive: resolve }));
        if (document.body.hasAttribute("data-fail-archive")) return { error: "Workspace is busy. Try again." };
        document.body.setAttribute("data-archived-workspace", workspaceId);
        return { error: null };
      },
      async list() {
        return {
          subscription: {
            subscriptionId: "browser-epoch",
            subscribe({ snapshot }: { snapshot: () => void }) {
              restoreSnapshot = snapshot;
              snapshot();
              return () => {};
            },
            async release() {},
          },
        };
      },
    },
  },
  async rpc(
    contract: { name: string },
    input: { id?: string; session: string; baseline: boolean }
  ) {
    if (contract.name === "celebrations.presented") {
      document.body.setAttribute("data-presented-celebration", input.id!);
      broker.presented(input.id!);
      return {};
    }
    return broker.poll(input);
  },
  addCommandCenterItem({ id, onSelect }: { id: string; onSelect: () => void }) {
    if (id === "preview-celebration") preview = onSelect;
    return () => {};
  },
  addSettingsScreen() {
    return () => {};
  },
};
Object.assign(window, {
  setCelebrationSettings: setTestSettings,
  queueCelebration: (id = "recovered") => broker.publish({
    ...previewCelebration, id, workspaceId: "merged-workspace",
  }),
});
const cleanup = contribute(pluginContext as unknown as PluginClientContext);
function App() {
  const [count, setCount] = useState(0);
  const [screen, setScreen] = useState<PluginOpenScreenInput | null>(null);
  const [openedWorkspace, setOpenedWorkspace] = useState("");
  showScreen = setScreen;
  const Screen = screen ? screens.get(screen.screenId) : undefined;
  const navigation = useMemo(() => ({
    openWorkspace({ workspaceId, serverId }: { workspaceId: string; serverId?: string }) {
      setOpenedWorkspace(`${workspaceId} on ${serverId}`);
      setScreen(null);
    },
    openAgent() {},
  }), []);
  const [dark, setDark] = useState(true);
  const compact = new URLSearchParams(location.search).has("compact");
  const theme = {
    colors: {
      surface0: dark ? "#18181b" : "#fafafa",
      surface1: dark ? "#27272a" : "#ffffff",
      surface2: "#333333",
      border: "#71717a",
      foreground: dark ? "#fafafa" : "#18181b",
      foregroundMuted: dark ? "#c0c0ca" : "#52525b",
      accent: "#8257e5",
      accentForeground: "#ffffff",
      statusSuccess: dark ? "#50dfb1" : "#137a58",
      statusWarning: "#ffc857",
      statusDanger: "#ff578f",
    },
  };
  return (
    <View
      style={{
        minHeight: "100%",
        height: "100%",
        backgroundColor: theme.colors.surface0,
      }}
    >
      <View style={{ padding: 20, gap: 18 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 24 }}>
          Paseo workspace • Current screen
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preview merge celebration"
          onPress={preview}
        >
          <Text style={{ color: theme.colors.foreground }}>Preview merge celebration</Text>
        </Pressable>
        <TextInput
          accessibilityLabel="Editor"
          placeholder="Keep typing here"
          style={{
            color: theme.colors.foreground,
            borderColor: theme.colors.border,
            borderWidth: 1,
            marginTop: 280,
            padding: 12,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Underlying action"
          onPress={() => setCount(count + 1)}
        >
          <Text style={{ color: theme.colors.foreground }}>Underlying action: {count}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch theme"
          onPress={() => setDark(!dark)}
        >
          <Text style={{ color: theme.colors.foreground }}>Switch theme</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Unload plugin" onPress={cleanup}>
          <Text style={{ color: theme.colors.foreground }}>Unload plugin</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reconnect host"
          onPress={() => restoreSnapshot()}
        >
          <Text style={{ color: theme.colors.foreground }}>Reconnect host</Text>
        </Pressable>
      </View>
      {openedWorkspace && <Text>Opened workspace: {openedWorkspace}</Text>}
      {Screen && screen && (
        <Screen
          host={host} theme={theme} layout={{ compact, platform: "web" }}
          params={screen.params ?? {}}
          navigation={new URLSearchParams(location.search).has("no-navigation") ? undefined : navigation}
        />
      )}
      <Bridge host={host} layout={{ compact, platform: "web" }} theme={theme} />
    </View>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
