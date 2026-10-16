import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { PluginHostProps } from "@getpaseo/plugin/client";
import type { CelebrationStore } from "./store";
const COLORS = ["#ff578f", "#ffc857", "#50dfb1", "#6da9ff", "#b391ff", "#ff9357"];
const PIECES = Array.from({ length: 72 }, (_, id) => ({
  id,
  left: `${(id * 37.13) % 100}%` as `${number}%`,
  delay: (id % 12) * 90,
  color: COLORS[id % COLORS.length],
  rotate: `${id * 51}deg`,
}));
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
function Confetti({ height }: { height: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 4800,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return (
    <View
      testID="confetti"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" }}
    >
      {PIECES.map((piece) => (
        <Animated.View
          key={piece.id}
          style={{
            position: "absolute",
            top: -24,
            left: piece.left,
            width: 8,
            height: piece.id % 2 ? 14 : 8,
            borderRadius: 2,
            backgroundColor: piece.color,
            opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [piece.delay / 6000, 1],
                  outputRange: [0, height + 100],
                  extrapolate: "clamp",
                }),
              },
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, piece.id % 2 ? 100 : -100],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [piece.rotate, `${piece.id * 51 + 540}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
export function CelebrationOverlay({
  theme,
  layout,
  store,
}: Pick<PluginHostProps, "theme" | "layout"> & { store: CelebrationStore }) {
  const event = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(store.dismiss, 16_000);
    return () => clearTimeout(timer);
  }, [event, store]);
  return (
    <>
      {event && (
        <View
          testID="celebration-overlay"
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        >
          {!reduced && <Confetti key={event.id} height={height} />}
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
                maxWidth: 440,
                maxHeight: height * 0.45,
                backgroundColor: theme.colors.surface1,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 18,
                gap: 8,
              }}
            >
              <View pointerEvents="none" style={{ gap: 8 }}>
                <Text
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                  style={{ color: theme.colors.statusSuccess, fontSize: 22, fontWeight: "700" }}
                >
                  Work shipped! 🎉
                </Text>
                <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600" }}>
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
