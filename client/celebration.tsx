import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { PluginHostProps } from "@getpaseo/plugin/client";
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
}: Pick<PluginHostProps, "theme" | "layout"> & { store: CelebrationStore }) {
  const event = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const motionGeneration = useSyncExternalStore(
    store.subscribe,
    store.getMotionGeneration,
    store.getMotionGeneration,
  );
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  return (
    <>
      {!reduced && (
        <Confetti
          key={motionGeneration}
          eventId={event?.id ?? null}
          width={width}
          height={height}
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
                  Work shipped! 🎉
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
              {event.issues.length > 0 && (
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss celebration"
                onPress={store.dismiss}
                style={{
                  alignSelf: "flex-end",
                  minHeight: 44,
                  minWidth: 88,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 8,
                  backgroundColor: theme.colors.accent,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{ color: theme.colors.accentForeground, fontWeight: "600" }}>
                  Dismiss
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
