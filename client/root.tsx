import { useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";
import { CelebrationOverlay } from "./celebration";
import type { CelebrationStore } from "./store";
import type { PresentationStore } from "./presentation";

export interface OverlayRootProps {
  store: CelebrationStore;
  presentation: PresentationStore;
}
export function OverlayRoot({ store, presentation }: OverlayRootProps) {
  const theme = useSyncExternalStore(
    presentation.subscribe,
    presentation.getSnapshot,
    presentation.getSnapshot,
  );
  const { width } = useWindowDimensions();
  return (
    <CelebrationOverlay
      theme={theme}
      layout={{ compact: width < 640, platform: "web" }}
      store={store}
    />
  );
}
