import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { contributeServer } from "../server/contribute";
import { command } from "../server/github";

test("a real archive hook retains a verified merge with zero polling clients", async () => {
  const root = await mkdtemp(join(tmpdir(), "celebration-offline-"));
  const previousPath = process.env.PATH;
  const hooks = new Map<string, (...args: any[]) => any>();
  const handlers = new Map<string, (...args: any[]) => any>();
  const cleanup = contributeServer({
    registerSettings() {},
    on(name, callback) {
      hooks.set(name, callback);
      return () => {};
    },
    handle(contract, callback) {
      handlers.set(contract.name, callback);
      return () => {};
    },
  } as PluginServerContext);
  try {
    const repository = join(root, "repo");
    const bin = join(root, "bin");
    await mkdir(repository);
    await mkdir(bin);
    await command("git", ["init", "-b", "feature", repository]);
    await command("git", [
      "-C",
      repository,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "Feature",
    ]);
    await command("git", [
      "-C",
      repository,
      "remote",
      "add",
      "origin",
      "https://github.com/example/repo.git",
    ]);
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
    const gh = join(bin, "gh");
    await writeFile(
      gh,
      `#!${
        process.execPath
      }\nconsole.log(JSON.stringify(process.argv[2] === "pr" ? ${JSON.stringify(
        pr
      )} : [{number:7000,head:{sha:${JSON.stringify(sha)}}}]));\n`
    );
    await chmod(gh, 0o755);
    process.env.PATH = `${bin}:${previousPath}`;
    const workspace = {
      id: "offline-workspace",
      projectId: "p",
      cwd: repository,
      name: "Offline feature",
      archivedAt: new Date().toISOString(),
    };
    hooks.get("workspace.created")!({ workspace });
    await hooks.get("workspace.archived")!({ workspace }, { signal: new AbortController().signal });
    const context = {
      paseo: {
        workspaces: {
          async list() {
            return {
              entries: [],
              pageInfo: {},
              subscription: { subscribe() {}, release() {} },
            };
          },
        },
      },
    };
    const poll = (session: string) =>
      handlers.get("celebrations.poll")!({ session, baseline: true }, context);
    const response = await poll("returning-window");
    assert.equal(response.events[0]?.title, "Ship offline");
    // A lost response or hidden window must remain recoverable until presentation.
    assert.equal((await poll("reconnected")).events[0]?.title, "Ship offline");
    handlers.get("celebrations.presented")!({ id: response.events[0].id });
    assert.deepEqual((await poll("later")).events, []);
  } finally {
    cleanup();
    process.env.PATH = previousPath;
    await rm(root, { recursive: true, force: true });
  }
});
