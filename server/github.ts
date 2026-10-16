import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { PluginHookContext, PluginHookWorkspace } from "@getpaseo/plugin/server";
import type { Celebration } from "../shared/celebration";
const execute = promisify(execFile);
export async function command(file: string, args: string[], signal?: AbortSignal) {
  const { stdout } = await execute(file, args, {
    timeout: 12_000,
    maxBuffer: 2 * 1024 * 1024,
    signal,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}
export interface Identity {
  root: string;
  branch: string;
  repository: string;
  prNumber: number | null;
}
export function githubRepository(remote: string): string | null {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(
      remote,
    );
  return match ? match[1] : null;
}
type Workspace = Awaited<
  ReturnType<PluginHookContext["paseo"]["workspaces"]["list"]>
>["entries"][number];
export function identify(workspace: Workspace): Identity | null {
  if (workspace.forge && workspace.forge !== "github") return null;
  const checkout = workspace.project?.checkout;
  const branch =
    workspace.gitRuntime?.currentBranch ?? (checkout?.isGit ? checkout.currentBranch : null);
  const remote = workspace.gitRuntime?.remoteUrl ?? (checkout?.isGit ? checkout.remoteUrl : null);
  const pr = workspace.githubRuntime?.pullRequest;
  const repository = pr
    ? githubRepository(pr.url.replace(/\/pull\/\d+\/?$/, ""))
    : remote && githubRepository(remote);
  if (!branch || !repository) return null;
  const root =
    checkout?.isGit && checkout.isPaseoOwnedWorktree
      ? checkout.mainRepoRoot
      : workspace.projectRootPath;
  return { root, branch, repository, prNumber: pr?.number ?? null };
}
export async function captureDirectory(cwd: string, signal: AbortSignal): Promise<Identity | null> {
  try {
    const branch = await command("git", ["-C", cwd, "symbolic-ref", "--short", "HEAD"], signal);
    const remote = await command("git", ["-C", cwd, "remote", "get-url", "origin"], signal);
    const repository = githubRepository(remote);
    if (!repository) return null;
    const worktrees = await command("git", ["-C", cwd, "worktree", "list", "--porcelain"], signal);
    const root = /^worktree (.+)$/m.exec(worktrees)?.[1];
    return root ? { root, branch, repository, prNumber: null } : null;
  } catch {
    return null;
  }
}
const associatedSchema = z.array(
  z.object({ number: z.number().int(), head: z.object({ sha: z.string() }) }),
);
const issueSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
});
const prSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string().url(),
  state: z.string(),
  mergedAt: z.string().nullable(),
  headRefOid: z.string(),
  closingIssuesReferences: z.array(z.object({ number: z.number().int(), url: z.string().url() })),
});
/** Deterministic excerpt of the linked issue, without model calls or executing Markdown. */
export function summarize(body: string | null, title: string): string {
  const text = (body ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return title;
  return text.length > 300 ? `${text.slice(0, 297).trimEnd()}…` : text;
}
export async function resolveCelebration(input: {
  workspace: PluginHookWorkspace;
  identity: Identity;
  signal: AbortSignal;
  run?: typeof command;
}): Promise<Celebration | null> {
  const { workspace, identity, signal, run = command } = input;
  if (!workspace.archivedAt) return null;
  // Worktree removal leaves refs/heads intact. Never run gh in the archived cwd.
  const sha = await run(
    "git",
    ["-C", identity.root, "rev-parse", "--verify", `refs/heads/${identity.branch}^{commit}`],
    signal,
  );
  if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error("Invalid branch commit");
  let numbers: number[];
  if (identity.prNumber) numbers = [identity.prNumber];
  else {
    const associated = associatedSchema.parse(
      JSON.parse(
        await run("gh", ["api", `repos/${identity.repository}/commits/${sha}/pulls`], signal),
      ),
    );
    numbers = associated.filter((pr) => pr.head.sha === sha).map((pr) => pr.number);
  }
  for (const number of numbers) {
    const pr = prSchema.parse(
      JSON.parse(
        await run(
          "gh",
          [
            "pr",
            "view",
            String(number),
            "--repo",
            identity.repository,
            "--json",
            "number,title,url,state,mergedAt,headRefOid,closingIssuesReferences",
          ],
          signal,
        ),
      ),
    );
    const mergedBeforeArchive =
      pr.state === "MERGED" &&
      pr.mergedAt !== null &&
      Date.parse(pr.mergedAt) <= Date.parse(workspace.archivedAt);
    if (!mergedBeforeArchive || pr.headRefOid !== sha) continue;
    const issues: Celebration["issues"] = [];
    for (const reference of pr.closingIssuesReferences.slice(0, 3)) {
      const repo = githubRepository(reference.url.replace(/\/issues\/\d+\/?$/, ""));
      if (!repo) continue;
      try {
        const issue = issueSchema.parse(
          JSON.parse(await run("gh", ["api", `repos/${repo}/issues/${reference.number}`], signal)),
        );
        issues.push({
          number: issue.number,
          title: issue.title,
          summary: summarize(issue.body, issue.title),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        console.warn("[merge-celebration] Issue recap unavailable", reference.number);
        issues.push({
          number: reference.number,
          title: `Issue #${reference.number}`,
          summary: "Issue details could not be loaded.",
        });
      }
    }
    return {
      id: `${workspace.id}:${workspace.archivedAt}`,
      workspaceName: workspace.name ?? identity.branch,
      title: pr.title,
      url: pr.url,
      issues,
    };
  }
  return null;
}
