import { useEffect } from "react";
import { Platform } from "react-native";
import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { createCelebrationStore } from "./client/store";
import { createPresentationStore, type PresentationStore } from "./client/presentation";
import { mountBrowserOverlay } from "./client/web";
import { startLiveEvents, reportPresented } from "./client/events";
import { SettingsScreen, useSettingsBridge } from "./client/settings";
import { OpenWorkspaceScreen } from "./client/workspace";
import { previewCelebration } from "./shared/celebration";

function ThemeBridge({
  theme,
  presentation,
}: PluginSidebarItemProps & { presentation: PresentationStore }) {
  useEffect(() => {
    presentation.update(theme);
  }, [theme, presentation]);
  useSettingsBridge(presentation);
  return null;
}
export default function contribute(client: PluginClientContext) {
  if (Platform.OS !== "web") return () => {};
  const store = createCelebrationStore();
  const presentation = createPresentationStore();
  const removeOpenWorkspace = client.addScreen({
    id: "open-workspace",
    title: "Open workspace",
    Component: OpenWorkspaceScreen,
  });
  const unmount = mountBrowserOverlay({
    store,
    presentation,
    onOpenWorkspace(workspaceId) {
      client.openScreen({ screenId: "open-workspace", params: { workspaceId } });
    },
    async onArchive(workspaceId) {
      const result = await client.paseo.workspaces.archive(workspaceId);
      if (result.error) throw new Error(result.error);
    },
    onPresented(id) {
      void reportPresented(client, store, id);
    },
  });
  let stopEvents = () => {};
  let started = false;
  const removeSettingsGate = presentation.subscribe(() => {
    if (started || !presentation.settingsReady()) return;
    started = true;
    stopEvents = startLiveEvents(client, {
      ...store,
      show(event) {
        if (presentation.getSettings().enabled) store.show(event);
        else void reportPresented(client, store, event.id);
      },
    });
  });
  function preview() {
    store.show({
      ...previewCelebration,
      id: `preview-${Date.now()}-${Math.random()}`,
    });
  }
  function Bridge(props: PluginSidebarItemProps) {
    return <ThemeBridge {...props} presentation={presentation} />;
  }
  const removeTheme = client.addSidebarFooterItem({
    id: "celebration-theme",
    title: "Merge celebration",
    Component: Bridge,
  });
  const removeSettings = client.addSettingsScreen({
    id: "settings",
    title: "Merge celebration",
    icon: "PartyPopper",
    Component: (props) => (
      <SettingsScreen {...props} presentation={presentation} onPreview={preview} />
    ),
  });
  const removePreview = client.addCommandCenterItem({
    id: "preview-celebration",
    title: "Preview merge celebration",
    icon: "PartyPopper",
    keywords: ["confetti", "celebrate", "merged"],
    context: "global",
    onSelect: preview,
  });
  const removeOpenSettings = client.addCommandCenterItem({
    id: "celebration-settings",
    title: "Merge celebration settings",
    icon: "Settings",
    keywords: ["confetti", "celebrate", "merged", "preferences"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings("settings");
    },
  });
  return () => {
    removeOpenWorkspace();
    removeOpenSettings();
    removePreview();
    removeSettings();
    removeTheme();
    removeSettingsGate();
    stopEvents();
    unmount?.();
    store.clear();
  };
}
