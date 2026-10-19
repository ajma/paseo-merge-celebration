import { expect, test, type Page } from "@playwright/test";
async function paperPixels(page: Page) {
  return page.getByTestId("confetti").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let maxY = 0;
    let signature = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (!data[index]) continue;
      count++;
      maxY = Math.max(maxY, Math.floor(index / 4 / canvas.width));
      signature = (signature + Math.imul(index, data[index])) >>> 0;
    }
    return {
      count,
      maxY: maxY / (canvas.width / canvas.getBoundingClientRect().width),
      signature,
    };
  });
}
test("a fresh shower starts empty, then enters from the top", async ({ page }) => {
  const start = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Preview merge celebration" }).click();
  await expect(page.getByTestId("confetti")).toBeVisible();
  expect((await paperPixels(page)).count).toBe(0);
  await page.clock.runFor(600);
  const entering = await paperPixels(page);
  expect(entering.count).toBeGreaterThan(0);
  expect(entering.maxY).toBeLessThan(100);
  await page.clock.runFor(2000);
  expect((await paperPixels(page)).maxY).toBeGreaterThan(200);
});
test("dismissal removes the recap while existing confetti finishes falling", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Preview merge celebration" }).click();
  await page.clock.runFor(2500);
  await page.getByRole("button", { name: "Dismiss celebration" }).click();
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
  await expect(page.getByTestId("confetti")).toBeVisible();
  const tail = await paperPixels(page);
  expect(tail.count).toBeGreaterThan(0);
  await page.clock.runFor(250);
  expect((await paperPixels(page)).signature).not.toBe(tail.signature);
  await page.getByRole("textbox", { name: "Editor" }).fill("Keep working during the tail");
  await expect(page.getByRole("textbox", { name: "Editor" })).toHaveValue(
    "Keep working during the tail"
  );
  await page.clock.runFor(15_000);
  await expect(page.getByTestId("confetti")).toHaveCount(0);
});
test("reconnecting cancels the old shower immediately instead of preserving its tail", async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Preview merge celebration" }).click();
  await page.clock.runFor(2000);
  expect((await paperPixels(page)).count).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Reconnect host" }).click();
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
  await expect(page.getByTestId("confetti")).toHaveCount(0, { timeout: 300 });
});
test("confetti keeps falling until dismissal and respects live reduced-motion changes", async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Preview merge celebration" }).click();
  await expect(page.getByTestId("celebration-overlay")).toBeVisible();
  await page.clock.runFor(17_000);
  await expect(page.getByTestId("celebration-overlay")).toBeVisible();
  const before = await paperPixels(page);
  expect(before.count).toBeGreaterThan(0);
  await page.clock.runFor(250);
  expect((await paperPixels(page)).signature).not.toBe(before.signature);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("confetti")).toHaveCount(0);
  await expect(page.getByTestId("celebration-overlay")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.getByTestId("confetti")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss celebration" }).click();
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
});
test("a celebration received while hidden starts when the same window becomes visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "Preview merge celebration" }).click();
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-presented-celebration");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("celebration-overlay")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-presented-celebration", /^preview-/);
  await expect(page.getByTestId("confetti")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("celebration-overlay")).toBeVisible();
  await expect(page.getByTestId("confetti")).toBeVisible();
});
for (const compact of [false, true]) {
  for (const reduced of [false, true]) {
    test(`preview keeps the screen usable; compact=${compact} reduced=${reduced}`, async ({
      page,
    }) => {
      page.on("pageerror", (error) => console.log(error.message));
      await page.setViewportSize(
        compact ? { width: 390, height: 844 } : { width: 1280, height: 800 }
      );
      await page.emulateMedia({
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      await page.goto(compact ? "/?compact" : "/");
      await page.getByRole("button", { name: "Preview merge celebration" }).click();
      await expect(page.getByTestId("celebration-overlay")).toBeVisible();
      await expect(page.locator("body")).toHaveAttribute("data-presented-celebration", /^preview-/);
      const viewport = page.viewportSize()!;
      expect(await page.getByTestId("celebration-overlay").boundingBox()).toEqual({
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
      await expect(page.getByText("#42: Celebrate shipped work")).toBeVisible();
      if (reduced) await expect(page.getByTestId("confetti")).toHaveCount(0);
      else {
        await expect(page.getByTestId("confetti")).toBeVisible();
        await expect.poll(async () => (await paperPixels(page)).maxY).toBeGreaterThan(140);
        expect(await page.getByTestId("confetti").boundingBox()).toEqual({
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
      }
      await page.getByRole("textbox", { name: "Editor" }).fill("Still editing");
      await page.getByRole("button", { name: "Underlying action" }).click();
      await expect(page.getByText("Underlying action: 1")).toBeVisible();
      await expect(page.getByRole("button", { name: "Dismiss celebration" })).toBeVisible();
      await page.getByRole("button", { name: "Switch theme" }).click();
      await expect(page.getByRole("button", { name: "Dismiss celebration" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Editor" })).toHaveValue("Still editing");
      await page.screenshot({
        animations: "disabled",
        timeout: 5000,
        path: `artifacts/preview-${compact ? "compact" : "wide"}-${
          reduced ? "reduced" : "motion"
        }.png`,
      });
      await page.getByRole("button", { name: "Dismiss celebration" }).click();
      await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
      await page.getByRole("button", { name: "Preview merge celebration" }).click();
      await expect(page.getByTestId("celebration-overlay")).toBeVisible();
      await page.getByRole("button", { name: "Unload plugin" }).click();
      await expect(page.locator("[data-merge-celebration-root]")).toHaveCount(0);
      await page.getByRole("button", { name: "Underlying action" }).click();
      await expect(page.getByText("Underlying action: 2")).toBeVisible();
    });
  }
}
test("saved settings change the headline, issue recap and confetti", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const set = (values: Record<string, unknown>) =>
    page.evaluate((next) => {
      (window as unknown as { setCelebrationSettings(v: unknown): void }).setCelebrationSettings(
        next
      );
    }, values);
  await set({
    verb: "landed",
    emoji: "🚀",
    showIssues: false,
    confetti: false,
  });
  await page.getByRole("button", { name: "Preview merge celebration" }).click();
  await expect(page.getByRole("heading", { name: "Work landed! 🚀" })).toBeVisible();
  await expect(page.getByText("Celebrate shipped work")).toHaveCount(0);
  await expect(page.getByTestId("confetti")).toHaveCount(0);
  await set({
    verb: "committed",
    emoji: "none",
    showIssues: true,
    confetti: true,
  });
  await expect(page.getByRole("heading", { name: "Work committed!", exact: true })).toBeVisible();
  await expect(page.getByText("#42: Celebrate shipped work")).toBeVisible();
});

test("recovered events wait for saved settings and respect disabled celebrations", async ({
  page,
}) => {
  await page.goto("/?settings-loading");
  await page.evaluate(() => (window as unknown as { queueCelebration(): void }).queueCelebration());
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as { setCelebrationSettings(v: unknown): void }).setCelebrationSettings({
      enabled: false,
    })
  );
  await expect(page.locator("body")).toHaveAttribute("data-presented-celebration", "recovered");
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
});

test("a hidden recovered celebration survives reconnect and appears once visible", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    (window as unknown as { queueCelebration(): void }).queueCelebration();
  });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Reconnect host" }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-presented-celebration");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("celebration-overlay")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-presented-celebration", "recovered");
  await page.getByRole("button", { name: "Dismiss celebration" }).click();
  await page.getByRole("button", { name: "Reconnect host" }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("celebration-overlay")).toHaveCount(0);
});
