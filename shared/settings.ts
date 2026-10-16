import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const VERBS = ["shipped", "landed", "merged", "committed", "deployed"] as const;
export const EMOJIS = ["🎉", "🚀", "✨", "🥳", "none"] as const;
export const SIZES = { small: 0.65, medium: 1, large: 1.5 } as const;
export const SPEEDS = { slow: 0.6, normal: 1, fast: 1.6 } as const;
export const AMOUNTS = { light: 0.5, normal: 1, heavy: 1.8 } as const;

const keys = <T extends object>(values: T) =>
  Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];

export const settingsSchema = z.object({
  enabled: z.boolean().default(true),
  verb: z.enum(VERBS).default("shipped"),
  emoji: z.enum(EMOJIS).default("🎉"),
  showIssues: z.boolean().default(true),
  confetti: z.boolean().default(true),
  confettiSize: z.enum(keys(SIZES)).default("medium"),
  confettiSpeed: z.enum(keys(SPEEDS)).default("normal"),
  confettiAmount: z.enum(keys(AMOUNTS)).default("normal"),
});
export type CelebrationSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: CelebrationSettings = settingsSchema.parse({});

export const celebrationSettings = defineSettings({
  id: "celebration",
  scope: "host",
  version: 1,
  schema: settingsSchema,
});

export function headline({ verb, emoji }: Pick<CelebrationSettings, "verb" | "emoji">) {
  return `Work ${verb}!${emoji === "none" ? "" : ` ${emoji}`}`;
}
export function confettiOptions(settings: CelebrationSettings) {
  return {
    size: SIZES[settings.confettiSize],
    speed: SPEEDS[settings.confettiSpeed],
    amount: AMOUNTS[settings.confettiAmount],
  };
}
export type ConfettiOptions = ReturnType<typeof confettiOptions>;
