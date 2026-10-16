import React, { useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { Pressable, Text, TextInput, View } from "react-native";
import type { PluginClientContext, PluginHostProps } from "@getpaseo/plugin/client";
import contribute from "../../index.client";
let Bridge: ComponentType<PluginHostProps>;
let preview: () => void;
let restoreSnapshot = () => {};
const host = { id: "test", label: "Test host" };
const pluginContext = {
  addSidebarFooterItem({ Component }: { Component: ComponentType<PluginHostProps> }) {
    Bridge = Component;
    return () => {};
  },
  paseo: {
    workspaces: {
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
  async rpc(contract: { name: string }, input: { id?: string }) {
    if (contract.name === "celebrations.presented") {
      document.body.setAttribute("data-presented-celebration", input.id!);
      return {};
    }
    return { events: [] };
  },
  addCommandCenterItem({ onSelect }: { onSelect: () => void }) {
    preview = onSelect;
    return () => {};
  },
};
const cleanup = contribute(pluginContext as unknown as PluginClientContext);
function App() {
  const [count, setCount] = useState(0);
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
    <View style={{ minHeight: "100%", height: "100%", backgroundColor: theme.colors.surface0 }}>
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
      <Bridge host={host} layout={{ compact, platform: "web" }} theme={theme} />
    </View>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
