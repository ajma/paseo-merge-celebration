import { useEffect } from "react";
import { Text } from "react-native";
import { useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import {
  AMOUNTS,
  EMOJIS,
  SIZES,
  SPEEDS,
  VERBS,
  celebrationSettings,
  headline,
  type CelebrationSettings,
} from "../shared/settings";
import type { PresentationStore } from "./presentation";

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);
const choices = <Value extends string>(values: readonly Value[]) =>
  values.map((value) => ({ value, label: capitalize(value) }));
const keysOf = <T extends object>(values: T) => Object.keys(values) as (keyof T & string)[];

/** Mirrors saved settings into the overlay, which renders outside Paseo's component tree. */
export function useSettingsBridge(presentation: PresentationStore) {
  const settings = useSettings(celebrationSettings);
  const values = settings.status === "ready" ? settings.values : null;
  useEffect(() => {
    if (values) presentation.updateSettings(values);
  }, [values, presentation]);
  return settings;
}

export function SettingsScreen({
  theme,
  presentation,
  onPreview,
}: PluginSurfaceProps & { presentation: PresentationStore; onPreview: () => void }) {
  const settings = useSettingsBridge(presentation);
  if (settings.status !== "ready") {
    const message =
      settings.status === "loading" ? "Loading settings…" : `Settings unavailable: ${settings.error}`;
    return <Text style={{ color: theme.colors.foregroundMuted }}>{message}</Text>;
  }
  const { values, revision, saving } = settings;
  function set<Key extends keyof CelebrationSettings>(key: Key, value: CelebrationSettings[Key]) {
    void settings.save({ ...values, [key]: value }, revision);
  }
  return (
    <>
      <SettingsSection title="Celebration">
        <SettingsCard>
          <SettingsSwitch
            label="Celebrate merged work"
            hint="Show a celebration when a workspace with a merged pull request is archived."
            value={values.enabled}
            disabled={saving}
            onValueChange={(value) => set("enabled", value)}
          />
          <SettingsSelect
            label="Verb"
            hint={`Headline reads “${headline(values)}”`}
            value={values.verb}
            options={choices(VERBS)}
            disabled={saving}
            onValueChange={(value) => set("verb", value)}
          />
          <SettingsSelect
            label="Emoji"
            value={values.emoji}
            options={EMOJIS.map((value) => ({
              value,
              label: value === "none" ? "None" : value,
            }))}
            disabled={saving}
            onValueChange={(value) => set("emoji", value)}
          />
          <SettingsSwitch
            label="Show linked issues"
            hint="Include summaries of the issues the pull request closes."
            value={values.showIssues}
            disabled={saving}
            onValueChange={(value) => set("showIssues", value)}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Confetti">
        <SettingsCard>
          <SettingsSwitch
            label="Show confetti"
            hint="Reduced motion always hides confetti."
            value={values.confetti}
            disabled={saving}
            onValueChange={(value) => set("confetti", value)}
          />
          <SettingsSelect
            label="Size"
            value={values.confettiSize}
            options={choices(keysOf(SIZES))}
            disabled={saving || !values.confetti}
            onValueChange={(value) => set("confettiSize", value)}
          />
          <SettingsSelect
            label="Speed"
            value={values.confettiSpeed}
            options={choices(keysOf(SPEEDS))}
            disabled={saving || !values.confetti}
            onValueChange={(value) => set("confettiSpeed", value)}
          />
          <SettingsSelect
            label="Amount"
            value={values.confettiAmount}
            options={choices(keysOf(AMOUNTS))}
            disabled={saving || !values.confetti}
            onValueChange={(value) => set("confettiAmount", value)}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Try it">
        <SettingsCard>
          <SettingsAction
            label="Preview merge celebration"
            hint="Nothing is archived and GitHub is not called."
            actionLabel="Preview"
            onPress={onPreview}
          />
        </SettingsCard>
      </SettingsSection>
      {settings.saveError ? (
        <Text style={{ color: theme.colors.statusDanger }}>{String(settings.saveError)}</Text>
      ) : null}
    </>
  );
}
