import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState, useWindowDimensions } from "react-native";
import { CelebrationOverlay } from "./celebration";
import type { CelebrationStore } from "./store";
import type { PresentationStore } from "./presentation";
import type { CelebrationShortcuts } from "./shortcuts";

export interface OverlayRootProps {
  store: CelebrationStore;
  presentation: PresentationStore;
  shortcuts?: CelebrationShortcuts;
  onOpenWorkspace?: (workspaceId: string) => void;
  onArchive?: (workspaceId: string) => Promise<void>;
  onPresented?: (id: string) => void;
}
export function OverlayRoot({
  store,
  presentation,
  onPresented,
  onArchive,
  onOpenWorkspace,
  shortcuts,
}: OverlayRootProps) {
  const [visible, setVisible] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      store.prune();
      setVisible(state === "active");
    });
    setVisible(AppState.currentState === "active");
    return () => subscription.remove();
  }, [store]);
  const event = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (event && visible) onPresented?.(event.id);
  }, [event, visible, onPresented]);
  const theme = useSyncExternalStore(
    presentation.subscribe,
    presentation.getSnapshot,
    presentation.getSnapshot
  );
  const settings = useSyncExternalStore(
    presentation.subscribe,
    presentation.getSettings,
    presentation.getSettings
  );
  const { width } = useWindowDimensions();
  if (!visible) return null;
  return (
    <CelebrationOverlay
      theme={theme}
      layout={{ compact: width < 640, platform: "web" }}
      store={store}
      settings={settings}
      onArchive={onArchive}
      onOpenWorkspace={onOpenWorkspace}
      shortcuts={shortcuts}
    />
  );
}
