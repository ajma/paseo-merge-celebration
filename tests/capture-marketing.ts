import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const server = await createServer({
  configFile: resolve("tests/vite.config.ts"),
  server: { port: 5197 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
  await page.clock.install();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Preview server has no TCP port");
  await page.goto(`http://127.0.0.1:${address.port}/marketing.html`);
  await page.getByRole("button", { name: "Dismiss celebration" }).waitFor();
  await page.getByTestId("confetti").waitFor();
  await page.clock.runFor(6000);
  if (errors.length) throw new Error(errors.join("\n"));
  await mkdir("docs", { recursive: true });
  await page.screenshot({ path: "docs/celebration-preview.png", animations: "disabled" });
  console.log("Saved docs/celebration-preview.png (staged workspace, actual plugin overlay)");
} finally {
  await browser?.close();
  await server.close();
}
