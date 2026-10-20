import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
}: Pick<PluginHostProps, "theme" | "layout"> & {
  store: CelebrationStore;
  settings: CelebrationSettings;
  onArchive?: (workspaceId: string) => Promise<void>;
  onOpenWorkspace?: (workspaceId: string) => void;
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
      {event && (
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
              <View pointerEvents="none" style={{ gap: layout.compact ? 8 : 10 }}>
                <Text
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                  style={{
                    color: theme.colors.statusSuccess,
                    fontSize: layout.compact ? 22 : 25,
                    fontWeight: "700",
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
                onOpenWorkspace={onOpenWorkspace}
                onDismiss={() => {
                  if (store.getSnapshot()?.id === event.id) store.dismiss();
                }}
              />
            </View>
          </View>
        </View>
      )}
    </>
  );
}

function CelebrationActions({
  theme,
  workspaceId,
  onArchive,
  onOpenWorkspace,
  onDismiss,
}: {
  theme: PluginHostProps["theme"];
  workspaceId?: string;
  onArchive?: (workspaceId: string) => Promise<void>;
  onOpenWorkspace?: (workspaceId: string) => void;
  onDismiss: () => void;
}) {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archiveDisabled = !workspaceId || !onArchive || archiving;
  const openDisabled = !workspaceId || !onOpenWorkspace || archiving;
  function openWorkspace() {
    if (!workspaceId || !onOpenWorkspace || archiving) return;
    setError(null);
    try {
      onOpenWorkspace(workspaceId);
      onDismiss();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not open workspace. Try again.");
    }
  }
  async function archive() {
    if (!workspaceId || !onArchive || archiving) return;
    setArchiving(true);
    setError(null);
    try {
      await onArchive(workspaceId);
      onDismiss();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not archive workspace. Try again.");
    } finally {
      setArchiving(false);
    }
  }
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
          accessibilityLabel="Dismiss celebration"
          onPress={onDismiss}
          style={{ ...button, backgroundColor: theme.colors.surface2 }}
        >
          <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>Dismiss</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open workspace"
          accessibilityState={{ disabled: openDisabled }}
          disabled={openDisabled}
          onPress={openWorkspace}
          style={{ ...button, backgroundColor: theme.colors.surface2, opacity: openDisabled ? 0.6 : 1 }}
        >
          <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>Open workspace</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Archive workspace"
          accessibilityState={{ disabled: archiveDisabled, busy: archiving }}
          disabled={archiveDisabled}
          onPress={() => void archive()}
          style={{ ...button, backgroundColor: theme.colors.accent, opacity: archiveDisabled ? 0.6 : 1 }}
        >
          <Text style={{ color: theme.colors.accentForeground, fontWeight: "600" }}>
            {archiving ? "Archiving…" : "Archive workspace"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
