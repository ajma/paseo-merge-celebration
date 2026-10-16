import { AppRegistry, Platform } from "react-native";
import { OverlayRoot, type OverlayRootProps } from "./root";

interface BrowserRoot {
  id: string;
  style: Record<string, string>;
  setAttribute(name: string, value: string): void;
  remove(): void;
}
declare const document: {
  createElement(tag: "div"): BrowserRoot;
  body: { appendChild(root: BrowserRoot): void };
};
const APP_KEY = "PaseoMergeCelebration";

/** Uses the host's renderer, with DOM access isolated to this web-only boundary. */
export function mountBrowserOverlay(props: OverlayRootProps): (() => void) | null {
  if (Platform.OS !== "web") return null;
  const root = document.createElement("div");
  root.id = `paseo-merge-celebration-${Math.random().toString(36).slice(2)}`;
  root.setAttribute("data-merge-celebration-root", "");
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "flex",
    pointerEvents: "none",
  });
  document.body.appendChild(root);
  AppRegistry.registerComponent(APP_KEY, () => OverlayRoot);
  let application: unknown;
  try {
    application = AppRegistry.runApplication(APP_KEY, { rootTag: root, initialProps: props });
  } catch (error) {
    root.remove();
    throw error;
  }
  let mounted = true;
  return () => {
    if (!mounted) return;
    mounted = false;
    try {
      // React Native Web 0.21 returns a React root; its unmount helper expects that root.
      if (
        application &&
        typeof application === "object" &&
        "unmount" in application &&
        typeof application.unmount === "function"
      )
        application.unmount();
      else Reflect.apply(AppRegistry.unmountApplicationComponentAtRootTag, AppRegistry, [root]);
    } finally {
      root.remove();
    }
  };
}
