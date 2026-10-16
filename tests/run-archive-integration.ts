import { copyFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
const source = process.env.PASEO_SOURCE;
if (!source) throw new Error("Set PASEO_SOURCE to a prepared Paseo checkout (see README.md).");
const fixture = join(
  resolve(source),
  "packages/server/src/server/plugins/merge-celebration.e2e.test.ts",
);
await copyFile("tests/paseo-archive.fixture", fixture);
try {
  const result = spawnSync(
    "npm",
    [
      "exec",
      "--",
      "vitest",
      "run",
      "src/server/plugins/merge-celebration.e2e.test.ts",
      "--bail=1",
      "--maxWorkers=1",
    ],
    {
      cwd: join(resolve(source), "packages/server"),
      stdio: "inherit",
      env: { ...process.env, MERGE_PLUGIN_DIR: process.cwd() },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await unlink(fixture);
}
