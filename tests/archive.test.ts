import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { contributeServer } from "../server/contribute";
import { command } from "../server/github";

test("workspace PR updates celebrate merges without archiving and retain them offline", async () => {
  const root = await mkdtemp(join(tmpdir(), "celebration-merge-"));
  const previousPath = process.env.PATH;
  const handlers = new Map<string, (...args: any[]) => any>();
  let observer: any;
  let released = false;
  const cleanup = contributeServer({
    registerSettings() {},
    handle(contract, callback) {
      handlers.set(contract.name, callback);
      return () => {};
    },
  } as unknown as PluginServerContext);
  try {
    const repository = join(root, "repo");
    const bin = join(root, "bin");
    await mkdir(repository);
    await mkdir(bin);
    await command("git", ["init", "-b", "feature", repository]);
    await command("git", ["-C", repository, "-c", "user.name=Test", "-c",
      "user.email=test@example.com", "commit", "--allow-empty", "-m", "Feature"]);
    const sha = await command("git", ["-C", repository, "rev-parse", "HEAD"]);
    const pr = {
      number: 7000,
      title: "Ship offline",
      url: "https://github.com/example/repo/pull/7000",
      state: "MERGED",
      mergedAt: "2026-01-01T00:00:00Z",
      headRefOid: sha,
      closingIssuesReferences: [],
    };
    const statePath = join(root, "pr.json");
    await writeFile(statePath, JSON.stringify(pr));
    const gh = join(bin, "gh");
    await writeFile(gh, `#!${process.execPath}\nconsole.log(require("fs").readFileSync(${JSON.stringify(statePath)}, "utf8"));\n`);
    await chmod(gh, 0o755);
    process.env.PATH = `${bin}:${previousPath}`;
    const workspace = {
      id: "workspace",
      projectId: "p",
      projectRootPath: repository,
      workspaceDirectory: repository,
      name: "Feature",
      gitRuntime: { currentBranch: "feature", remoteUrl: "https://github.com/example/repo.git" },
      githubRuntime: { pullRequest: { ...pr, headRefName: "feature", isMerged: false } },
    };
    const historical = {
      ...workspace, id: "historical",
      githubRuntime: { pullRequest: { ...workspace.githubRuntime.pullRequest, isMerged: true } },
    };
    let entries = [workspace, historical];
    const context = { paseo: { workspaces: { async list() {
      return {
        entries, pageInfo: {},
        subscription: { subscribe(callbacks: any) { observer = callbacks; }, release() { released = true; } },
      };
    } } } };
    const poll = (session: string) => handlers.get("celebrations.poll")!({ session, baseline: true }, context);
    assert.deepEqual((await poll("initial")).events, []);
    const update = (value: any) => observer.update({ type: "workspace_update", payload: { kind: "upsert", workspace: value } });
    update(workspace);
    update(historical);
    assert.deepEqual((await poll("still-open")).events, []);
    const merged = { ...workspace, githubRuntime: historical.githubRuntime };
    // The subscription keeps watching even with no client polling during the merge.
    update(merged);
    let response: any;
    for (let attempts = 0; attempts < 100; attempts++) {
      response = await poll("returning-window");
      if (response.events.length) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(response.events[0]?.title, "Ship offline");
    assert.equal(response.events[0]?.workspaceId, "workspace");
    const id = response.events[0].id;
    assert.equal((await poll("reconnected")).events[0]?.id, id);
    handlers.get("celebrations.presented")!({ id });
    update(merged);
    observer.snapshot({ entries: [merged, historical] });
    assert.deepEqual((await poll("later")).events, []);
    // Another PR on the same workspace is a separate merge, and lookup failures can retry.
    const nextPr = { ...pr, number: 7001, url: "https://github.com/example/repo/pull/7001" };
    const next = { ...merged, githubRuntime: { pullRequest: { ...nextPr, headRefName: "feature", isMerged: true } } };
    await writeFile(statePath, JSON.stringify({ ...nextPr, state: "OPEN", mergedAt: null }));
    update(next);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual((await poll("unverified")).events, []);
    await writeFile(statePath, JSON.stringify(nextPr));
    update(next);
    for (let attempts = 0; attempts < 100; attempts++) {
      response = await poll("next-merge");
      if (response.events.length) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(response.events[0]?.id, `workspace:${nextPr.url}`);
    handlers.get("celebrations.presented")!({ id: response.events[0].id });
    // A terminal subscription error reacquires state without treating a new merge as history.
    const reconnectedPr = { ...nextPr, number: 7002, url: "https://github.com/example/repo/pull/7002" };
    await writeFile(statePath, JSON.stringify(reconnectedPr));
    entries = [{ ...next, githubRuntime: { pullRequest: { ...reconnectedPr, headRefName: "feature", isMerged: true } } }];
    observer.error(new Error("Subscription closed"));
    for (let attempts = 0; attempts < 100; attempts++) {
      response = await poll("restored-observation");
      if (response.events.length) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(response.events[0]?.id, `workspace:${reconnectedPr.url}`);
  } finally {
    cleanup();
    assert.equal(released, true);
    process.env.PATH = previousPath;
    await rm(root, { recursive: true, force: true });
  }
});
