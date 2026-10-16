import { useEffect } from "react";
import { Platform } from "react-native";
import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { createCelebrationStore } from "./client/store";
import { createPresentationStore, type PresentationStore } from "./client/presentation";
import { mountBrowserOverlay } from "./client/web";
import { startLiveEvents } from "./client/events";
import { previewCelebration, reportCelebration } from "./shared/celebration";

function ThemeBridge({
  theme,
  presentation,
}: PluginSidebarItemProps & { presentation: PresentationStore }) {
  useEffect(() => {
    presentation.update(theme);
  }, [theme, presentation]);
  return null;
}
export default function contribute(client: PluginClientContext) {
  if (Platform.OS !== "web") return () => {};
  const store = createCelebrationStore();
  const presentation = createPresentationStore();
  const unmount = mountBrowserOverlay({
    store,
    presentation,
    onPresented(id) {
      void client.rpc(reportCelebration, { id }).catch(() => {});
    },
  });
  const stopEvents = startLiveEvents(client, store);
  function Bridge(props: PluginSidebarItemProps) {
    return <ThemeBridge {...props} presentation={presentation} />;
  }
  const removeTheme = client.addSidebarFooterItem({
    id: "celebration-theme",
    title: "Merge celebration",
    Component: Bridge,
  });
  const removePreview = client.addCommandCenterItem({
    id: "preview-celebration",
    title: "Preview merge celebration",
    icon: "PartyPopper",
    keywords: ["confetti", "celebrate", "merged"],
    context: "global",
    onSelect() {
      store.show({ ...previewCelebration, id: `preview-${Date.now()}-${Math.random()}` });
    },
  });
  return () => {
    removePreview();
    removeTheme();
    stopEvents();
    unmount?.();
    store.clear();
  };
}
