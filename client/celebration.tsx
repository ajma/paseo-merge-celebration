import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { PluginHostProps } from "@getpaseo/plugin/client";
import { confettiOptions, headline, type CelebrationSettings } from "../shared/settings";
import type { CelebrationStore } from "./store";
import { Confetti } from "./confetti.web";
import type { CelebrationShortcuts } from "./shortcuts";
function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
export function CelebrationOverlay({
  theme,
  layout,
  store,
  settings,
  onArchive,
  onOpenWorkspace,
  shortcuts,
}: Pick<PluginHostProps, "theme" | "layout"> & {
  store: CelebrationStore;
  settings: CelebrationSettings;
  onArchive?: (workspaceId: string) => Promise<void>;
  onOpenWorkspace?: (workspaceId: string) => void;
  shortcuts?: CelebrationShortcuts;
}) {
  const event = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const motionGeneration = useSyncExternalStore(
    store.subscribe,
    store.getMotionGeneration,
    store.getMotionGeneration,
  );
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const options = useMemo(() => confettiOptions(settings), [settings]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  function isCurrent() {
    return event !== null && store.getSnapshot()?.id === event.id;
  }
  function dismiss() {
    if (isCurrent()) store.dismiss();
  }
  return (
    <>
      {!reduced && settings.confetti && (
        <Confetti
          key={motionGeneration}
          eventId={event?.id ?? null}
          width={width}
          height={height}
          options={options}
        />
      )}
      {archiveError && (
        <ArchiveErrorDialog
          theme={theme}
          compact={layout.compact}
          message={archiveError}
          onDismiss={() => setArchiveError(null)}
          shortcuts={shortcuts}
        />
      )}
      {event && !archiveError && (
        <View
          testID="celebration-overlay"
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        >
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: layout.compact ? 64 : 48,
              left: 16,
              right: 16,
              alignItems: "center",
            }}
          >
            <View
              testID="celebration-card"
              pointerEvents="box-none"
              style={{
                width: "100%",
                maxWidth: layout.compact ? 440 : 520,
                maxHeight: height * (layout.compact ? 0.5 : 0.55),
                backgroundColor: theme.colors.surface1,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: layout.compact ? 18 : 22,
                gap: layout.compact ? 8 : 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss celebration"
                accessibilityHint="Keyboard shortcut: Escape"
                aria-keyshortcuts="Escape"
                onPress={dismiss}
                style={{
                  position: "absolute", top: 6, right: 6, width: 44, height: 44,
                  alignItems: "center", justifyContent: "center", borderRadius: 8,
                }}
              >
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 26, lineHeight: 28 }}>×</Text>
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 10 }}>Esc</Text>
              </Pressable>
              <View pointerEvents="none" style={{ gap: layout.compact ? 8 : 10 }}>
                <Text
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                  style={{
                    color: theme.colors.statusSuccess,
                    fontSize: layout.compact ? 22 : 25,
                    fontWeight: "700",
                    paddingRight: 36,
                  }}
                >
                  {headline(settings)}
                </Text>
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontSize: layout.compact ? 16 : 17,
                    fontWeight: "600",
                  }}
                >
                  {event.title}
                </Text>
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>
                  {event.workspaceName}
                </Text>
              </View>
              {settings.showIssues && event.issues.length > 0 && (
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8 }}>
                  {event.issues.map((issue) => (
                    <View key={issue.number} style={{ gap: 4 }}>
                      <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>
                        #{issue.number}: {issue.title}
                      </Text>
                      <Text style={{ color: theme.colors.foregroundMuted, lineHeight: 19 }}>
                        {issue.summary}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <CelebrationActions
                key={event.id}
                theme={theme}
                workspaceId={event.workspaceId}
                onArchive={onArchive}
                onArchiveError={setArchiveError}
                onOpenWorkspace={onOpenWorkspace}
                onDismiss={dismiss}
                isCurrent={isCurrent}
                shortcuts={shortcuts}
              />
            </View>
          </View>
        </View>
      )}
    </>
  );
}

function ArchiveErrorDialog({
  theme,
  compact,
  message,
  onDismiss,
  shortcuts,
}: {
  theme: PluginHostProps["theme"];
  compact: boolean;
  message: string;
  onDismiss: () => void;
  shortcuts?: CelebrationShortcuts;
}) {
  useEffect(() => shortcuts?.subscribe({ dismiss: onDismiss }), [shortcuts, onDismiss]);
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: compact ? 64 : 48, left: 16, right: 16, alignItems: "center" }}
    >
      <View
        role="alertdialog"
        accessibilityLabel="Could not archive workspace"
        style={{
          width: "100%", maxWidth: compact ? 440 : 520, padding: compact ? 18 : 22,
          backgroundColor: theme.colors.surface1, borderColor: theme.colors.border,
          borderWidth: 1, borderRadius: 16, gap: 16,
        }}
      >
        <Text accessibilityRole="header" style={{ color: theme.colors.foreground, fontSize: 20, fontWeight: "700" }}>
          Could not archive workspace
        </Text>
        <Text accessibilityRole="alert" style={{ color: theme.colors.statusDanger }}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          aria-keyshortcuts="Escape"
          onPress={onDismiss}
          style={{
            alignSelf: "flex-end", minHeight: 44, paddingHorizontal: 16, borderRadius: 8,
            justifyContent: "center", backgroundColor: theme.colors.surface2,
          }}
        >
          <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CelebrationActions({
  theme,
  workspaceId,
  onArchive,
  onArchiveError,
  onOpenWorkspace,
  onDismiss,
  isCurrent,
  shortcuts,
}: {
  theme: PluginHostProps["theme"];
  workspaceId?: string;
  onArchive?: (workspaceId: string) => Promise<void>;
  onArchiveError: (message: string) => void;
  onOpenWorkspace?: (workspaceId: string) => void;
  onDismiss: () => void;
  isCurrent: () => boolean;
  shortcuts?: CelebrationShortcuts;
}) {
  const [error, setError] = useState<string | null>(null);
  const archivingRef = useRef(false);
  const archiveDisabled = !workspaceId || !onArchive;
  const openDisabled = !workspaceId || !onOpenWorkspace;
  function openWorkspace() {
    if (!isCurrent() || !workspaceId || !onOpenWorkspace || archivingRef.current) return;
    setError(null);
    try {
      onOpenWorkspace(workspaceId);
      onDismiss();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not open workspace. Try again.");
    }
  }
  async function archive() {
    if (!isCurrent() || !workspaceId || !onArchive || archivingRef.current) return;
    archivingRef.current = true;
    onDismiss();
    try {
      await onArchive(workspaceId);
    } catch (error) {
      onArchiveError(error instanceof Error ? error.message : "Could not archive workspace. Try again.");
    }
  }
  useEffect(() => shortcuts?.subscribe({
    dismiss: onDismiss,
    openWorkspace: openDisabled ? undefined : openWorkspace,
    archiveWorkspace: archiveDisabled ? undefined : () => void archive(),
  }), [shortcuts, onDismiss, openDisabled, archiveDisabled, openWorkspace, archive]);
  const button = {
    minHeight: 44,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderRadius: 8,
    paddingHorizontal: 16,
  };
  return (
    <View style={{ gap: 8 }}>
      {error && (
        <Text accessibilityRole="alert" style={{ color: theme.colors.statusDanger }}>
          {error}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open workspace"
          aria-keyshortcuts="Alt+O"
          accessibilityState={{ disabled: openDisabled }}
          disabled={openDisabled}
          onPress={openWorkspace}
          style={{ ...button, flexDirection: "row", gap: 10, backgroundColor: theme.colors.surface2, opacity: openDisabled ? 0.6 : 1 }}
        >
          <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>Open workspace</Text>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
            {shortcuts?.labels.openWorkspace ?? "Alt+O"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Archive workspace"
          aria-keyshortcuts="Alt+A"
          accessibilityState={{ disabled: archiveDisabled }}
          disabled={archiveDisabled}
          onPress={() => void archive()}
          style={{ ...button, flexDirection: "row", gap: 10, backgroundColor: theme.colors.accent, opacity: archiveDisabled ? 0.6 : 1 }}
        >
          <Text style={{ color: theme.colors.accentForeground, fontWeight: "600" }}>
            Archive workspace
          </Text>
          <Text style={{ color: theme.colors.accentForeground, fontSize: 12 }}>
            {shortcuts?.labels.archiveWorkspace ?? "Alt+A"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
