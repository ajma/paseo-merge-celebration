import { expect, test } from "@playwright/test";
for (const compact of [false, true]) {
  for (const reduced of [false, true]) {
    test(`preview keeps the screen usable; compact=${compact} reduced=${reduced}`, async ({
      page,
    }) => {
      page.on("pageerror", (error) => console.log(error.message));
      await page.setViewportSize(
        compact ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      );
      await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      await page.goto(compact ? "/?compact" : "/");
      await page.getByRole("button", { name: "Preview merge celebration" }).click();
      await expect(page.getByTestId("celebration-overlay")).toBeVisible();
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
        await expect
          .poll(() =>
            page
              .getByTestId("confetti")
              .locator(":scope > div")
              .first()
              .evaluate((element) => element.getBoundingClientRect().top),
          )
          .toBeGreaterThan(140);
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
        path: `artifacts/preview-${compact ? "compact" : "wide"}-${reduced ? "reduced" : "motion"}.png`,
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
