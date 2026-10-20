import { AppRegistry, Platform } from "react-native";
import { OverlayRoot, type OverlayRootProps } from "./root";
import type { CelebrationShortcutActions, CelebrationShortcuts } from "./shortcuts";

interface BrowserRoot {
  id: string;
  style: Record<string, string>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  remove(): void;
}
declare const document: {
  createElement(tag: "div"): BrowserRoot;
  body: { appendChild(root: BrowserRoot): void };
  visibilityState: string;
  querySelectorAll(selector: string): { readonly length: number; [index: number]: BrowserRoot };
  addEventListener(type: "keydown", listener: (event: KeyboardInput) => void, capture: boolean): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardInput) => void, capture: boolean): void;
};
declare const navigator: { platform: string };
interface KeyboardInput {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  target: { closest?(selector: string): unknown } | null;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}
const APP_KEY = "PaseoMergeCelebration";

function subscribeShortcuts(root: BrowserRoot, actions: CelebrationShortcutActions) {
  root.setAttribute("data-merge-celebration-active", "");
  function keydown(event: KeyboardInput) {
    if (
      document.visibilityState === "hidden" || event.defaultPrevented || event.isComposing ||
      event.repeat || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.target?.closest?.('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])')
    ) return;
    let action: (() => void) | undefined;
    if (event.key === "Escape" && !event.altKey) action = actions.dismiss;
    // Option produces accented characters on macOS; physical codes stay stable.
    if (event.altKey && event.code === "KeyO") action = actions.openWorkspace;
    if (event.altKey && event.code === "KeyA") action = actions.archiveWorkspace;
    if (!action) return;
    // Hosts share a document. Later roots paint on top, independent of listener order.
    const active = document.querySelectorAll("[data-merge-celebration-root][data-merge-celebration-active]");
    if (active[active.length - 1] !== root) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    action();
  }
  document.addEventListener("keydown", keydown, true);
  return () => {
    root.removeAttribute("data-merge-celebration-active");
    document.removeEventListener("keydown", keydown, true);
  };
}

/** Uses the host's renderer, with DOM access isolated to this web-only boundary. */
export function mountBrowserOverlay(props: OverlayRootProps): (() => void) | null {
  if (Platform.OS !== "web") return null;
  const root = document.createElement("div");
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌥" : "Alt+";
  const shortcuts: CelebrationShortcuts = {
    labels: { openWorkspace: `${modifier}O`, archiveWorkspace: `${modifier}A` },
    subscribe: (actions) => subscribeShortcuts(root, actions),
  };
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
    application = AppRegistry.runApplication(APP_KEY, {
      rootTag: root,
      initialProps: { ...props, shortcuts },
    });
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
