export interface CelebrationShortcutActions {
  dismiss(): void;
  openWorkspace?: () => void;
  archiveWorkspace?: () => void;
}

/** Supplied by the browser boundary; components never access the DOM. */
export interface CelebrationShortcuts {
  labels: { openWorkspace: string; archiveWorkspace: string };
  subscribe(actions: CelebrationShortcutActions): () => void;
}
