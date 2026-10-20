import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
export const RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_PENDING = 100;
export const celebrationSchema = z.object({
  id: z.string(),
  workspaceName: z.string(),
  workspaceId: z.string().optional(),
  expiresAt: z.number().optional(),
  title: z.string(),
  url: z.string().url(),
  issues: z.array(
    z.object({
      number: z.number().int(),
      title: z.string(),
      summary: z.string(),
    })
  ),
});
export type Celebration = z.infer<typeof celebrationSchema>;
export const pollCelebrations = defineRpc({
  name: "celebrations.poll",
  input: z.object({
    session: z.string().min(1).max(100),
    baseline: z.boolean(),
  }),
  output: z.object({ events: z.array(celebrationSchema) }),
});
export const reportCelebration = defineRpc({
  name: "celebrations.presented",
  input: z.object({ id: z.string().min(1).max(300) }),
  output: z.object({}),
});
export const diagnoseCelebration = defineRpc({
  name: "celebrations.diagnose",
  input: z.object({ preview: z.boolean() }),
  output: z.object({
    clients: z.number().int(),
    previewId: z.string().nullable(),
  }),
});
export const previewCelebration: Celebration = {
  id: "preview",
  workspaceName: "Celebration preview",
  title: "Fullscreen celebrations for shipped work",
  url: "https://github.com/getpaseo/paseo",
  issues: [
    {
      number: 42,
      title: "Celebrate shipped work",
      summary:
        "Added a fullscreen celebration when a pull request merges, with dismiss, open workspace and archive buttons and support for reduced motion.",
    },
  ],
};
