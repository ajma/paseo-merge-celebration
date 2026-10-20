import { useEffect, useState } from "react";
import { Text } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";

/** Navigation is supplied to plugin screens, rather than the detached overlay. */
export function OpenWorkspaceScreen({ navigation, host, params, theme }: PluginScreenProps) {
  const workspaceId = params.workspaceId;
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!navigation || !workspaceId) return;
    try {
      navigation.openWorkspace({ workspaceId, serverId: host.id });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not open workspace. Try the sidebar.");
    }
  }, [navigation, host.id, workspaceId]);
  const unavailable = !navigation || !workspaceId;
  return (
    <Text
      accessibilityRole={error || unavailable ? "alert" : undefined}
      style={{ color: theme.colors.foregroundMuted }}
    >
      {error ?? (unavailable ? "Open this workspace from the sidebar." : "Opening workspace…")}
    </Text>
  );
}
