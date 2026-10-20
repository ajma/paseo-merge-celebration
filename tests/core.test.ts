import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBroker } from "../server/broker";
import { command, resolveCelebration, summarize, githubRepository } from "../server/github";
import type { PluginClientContext } from "@getpaseo/plugin/client";
import { createCelebrationStore } from "../client/store";
import { previewCelebration } from "../shared/celebration";

const sha = "a".repeat(40);
const workspace = {
  id: "w",
  projectId: "p",
  cwd: "/deleted/worktree",
  name: "Feature",
  archivedAt: null,
};
const identity = {
  root: "/surviving/repo",
  branch: "feature",
  repository: "owner/repo",
  prNumber: 7,
};
const merged = {
  number: 7,
  title: "Fix it",
  url: "https://github.com/owner/repo/pull/7",
  state: "MERGED",
  mergedAt: "2026-10-15T11:59:59.000Z",
  headRefOid: sha,
  closingIssuesReferences: [{ number: 3, url: "https://github.com/owner/repo/issues/3" }],
};
function resolve(pr: Omit<typeof merged, "mergedAt"> & { mergedAt: string | null } = merged) {
  return resolveCelebration({
    workspace,
    identity,
    signal: new AbortController().signal,
    run: async (file, args) => {
      if (file === "git") {
        assert.deepEqual(args.slice(0, 2), ["-C", identity.root]);
        return sha;
      }
      if (args[0] === "pr") return JSON.stringify(pr);
      return JSON.stringify({
        number: 3,
        title: "Bug",
        body: "# Fix keyboard focus\nKeep the editor usable.",
      });
    },
  });
}
test("celebrates an exact merged PR and includes a linked issue recap", async () => {
  assert.deepEqual(await resolve(), {
    id: `w:${merged.url}`,
    workspaceId: "w",
    workspaceName: "Feature",
    title: "Fix it",
    url: merged.url,
    issues: [
      {
        number: 3,
        title: "Bug",
        summary: "Fix keyboard focus Keep the editor usable.",
      },
    ],
  });
});
test("open, closed and mismatched PRs stay silent", async () => {
  assert.equal(await resolve({ ...merged, state: "OPEN", mergedAt: null }), null);
  assert.equal(await resolve({ ...merged, state: "CLOSED" }), null);
  assert.equal(await resolve({ ...merged, headRefOid: "b".repeat(40) }), null);
});
test("a merge with no live clients is recovered after reconnect until presented", () => {
  let time = 0;
  const broker = createBroker(() => time);
  broker.poll({ session: "old", baseline: true });
  time = 60_000;
  assert.equal(broker.audience().size, 0);
  broker.publish(previewCelebration);
  assert.deepEqual(
    broker.poll({ session: "new", baseline: true }).events.map((event) => event.id),
    ["preview"]
  );
  assert.deepEqual(broker.poll({ session: "new", baseline: false }).events, []);
  // Delivery alone is not confirmation that the overlay was visible.
  assert.deepEqual(
    broker.poll({ session: "restored", baseline: true }).events.map((event) => event.id),
    ["preview"]
  );
  broker.presented("preview");
  assert.deepEqual(broker.poll({ session: "again", baseline: true }).events, []);
});
test("pending celebrations expire after a day and reload clears volatile history", () => {
  let time = 0;
  const broker = createBroker(() => time);
  broker.publish(previewCelebration);
  time = 24 * 60 * 60 * 1000;
  assert.deepEqual(broker.poll({ session: "late", baseline: true }).events, []);
  broker.publish({ ...previewCelebration, id: "fresh" });
  broker.clear();
  assert.deepEqual(broker.poll({ session: "restart", baseline: true }).events, []);
});
test("multiple recovered celebrations appear in order and dismissed ones stay dismissed", () => {
  const store = createCelebrationStore();
  store.show(previewCelebration);
  store.show({ ...previewCelebration, id: "second" });
  assert.equal(store.getSnapshot()?.id, "preview");
  store.dismiss();
  assert.equal(store.getSnapshot()?.id, "second");
  store.dismiss();
  store.show(previewCelebration);
  assert.equal(store.getSnapshot(), null);
});
test("dismissed events cannot replay, and preview can run again with a new ID", () => {
  const store = createCelebrationStore();
  store.show(previewCelebration);
  store.dismiss();
  store.show(previewCelebration);
  assert.equal(store.getSnapshot(), null);
  store.show({ ...previewCelebration, id: "preview-again" });
  assert.equal(store.getSnapshot()?.id, "preview-again");
});
test("GitHub parsing and recaps do not render scripts, images or code", () => {
  assert.equal(githubRepository("git@github.com:owner/repo.git"), "owner/repo");
  assert.equal(githubRepository("https://gitlab.com/owner/repo.git"), null);
  assert.equal(
    summarize(
      "<!-- hidden --> # Fix [focus](https://example.com) ![image](url) ```secret```",
      "Fallback"
    ),
    "Fix focus"
  );
});
test("merge lookup works after a real worktree is deleted and its branch survives", async () => {
  const root = await mkdtemp(join(tmpdir(), "merge-celebration-"));
  const worktree = join(root, "worktree");
  try {
    await command("git", ["init", root]);
    await command("git", [
      "-C",
      root,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "test",
    ]);
    await command("git", ["-C", root, "worktree", "add", "-b", "feature", worktree]);
    const actualSha = await command("git", ["-C", worktree, "rev-parse", "HEAD"]);
    await command("git", ["-C", root, "worktree", "remove", worktree]);
    const event = await resolveCelebration({
      workspace: { ...workspace, cwd: worktree },
      identity: { ...identity, root },
      signal: new AbortController().signal,
      run: async (file, args, signal) =>
        file === "git"
          ? command(file, args, signal)
          : JSON.stringify({
              ...merged,
              headRefOid: actualSha,
              closingIssuesReferences: [],
            }),
    });
    assert.equal(event?.title, "Fix it");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("GitHub failures fail closed instead of producing a celebration", async () => {
  await assert.rejects(
    () =>
      resolveCelebration({
        workspace,
        identity,
        signal: new AbortController().signal,
        run: async (file) => {
          if (file === "git") return sha;
          throw new Error("GitHub unavailable");
        },
      }),
    /GitHub unavailable/
  );
});

test("a missing issue title in gh PR references does not block a merged celebration", async () => {
  const event = await resolve();
  assert.equal(event?.title, "Fix it");
  assert.deepEqual(event?.issues, [
    {
      number: 3,
      title: "Bug",
      summary: "Fix keyboard focus Keep the editor usable.",
    },
  ]);
});
test("an inaccessible linked issue cannot suppress a verified merge celebration", async () => {
  const event = await resolveCelebration({
    workspace,
    identity,
    signal: new AbortController().signal,
    run: async (file, args) => {
      if (file === "git") return sha;
      if (args[0] === "pr") return JSON.stringify(merged);
      throw new Error("Issue unavailable");
    },
  });
  assert.equal(event?.title, "Fix it");
  assert.deepEqual(event?.issues, [
    {
      number: 3,
      title: "Issue #3",
      summary: "Issue details could not be loaded.",
    },
  ]);
});
test("settings default to the original celebration and build its headline", async () => {
  const { defaultSettings, headline, settingsSchema } = await import("../shared/settings");
  assert.equal(headline(defaultSettings), "Work shipped! 🎉");
  assert.equal(headline({ verb: "landed", emoji: "none" }), "Work landed!");
  assert.deepEqual(settingsSchema.parse({}), defaultSettings);
  assert.equal(settingsSchema.safeParse({ verb: "yeeted" }).success, false);
});

test("a hidden client bounds and expires its undisplayed queue", () => {
  let now = 0;
  const store = createCelebrationStore(() => now);
  for (let i = 0; i < 101; i++)
    store.show({ ...previewCelebration, id: String(i), expiresAt: 1000 });
  let count = 0;
  while (store.getSnapshot()) {
    count++;
    store.dismiss();
  }
  assert.equal(count, 100);
  store.show({ ...previewCelebration, id: "expire", expiresAt: 1000 });
  now = 1000;
  store.prune();
  assert.equal(store.getSnapshot(), null);
});

test("dismissing an expired recap does not also dismiss the next recovered event", () => {
  let now = 0;
  const store = createCelebrationStore(() => now);
  store.show({ ...previewCelebration, id: "old", expiresAt: 1000 });
  store.show({ ...previewCelebration, id: "next", expiresAt: 2000 });
  now = 1000;
  store.dismiss();
  assert.equal(store.getSnapshot()?.id, "next");
});
