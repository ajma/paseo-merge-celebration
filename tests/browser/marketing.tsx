import { createCelebrationStore } from "../../client/store";
import { createPresentationStore } from "../../client/presentation";
import { mountBrowserOverlay } from "../../client/web";

// Fictional workspace content, with the actual plugin UI mounted on top.
const store = createCelebrationStore();
const presentation = createPresentationStore();
presentation.update({
  colors: {
    surface0: "#282c34",
    surface1: "#2c313c",
    surface2: "#3e4451",
    border: "#454d5c",
    foreground: "#d1d5dd",
    foregroundMuted: "#a5aebd",
    accent: "#61afef",
    accentForeground: "#20242c",
    statusSuccess: "#98c379",
    statusWarning: "#e5c07b",
    statusDanger: "#e06c75",
  },
});
mountBrowserOverlay({
  store,
  presentation,
  onOpenWorkspace: () => { store.dismiss(); },
  onArchive: async () => { store.dismiss(); },
});
store.show({
  id: "marketing-preview",
  workspaceName: "Keyboard shortcuts",
  workspaceId: "fictional-workspace",
  title: "Find your way around faster",
  url: "https://github.com/example/launchpad/pull/128",
  issues: [
    {
      number: 42,
      title: "Keyboard shortcuts, everywhere",
      summary:
        "Added shortcuts for switching workspaces, opening search, and picking up where you left off.",
    },
  ],
});
