// Quantity boxes on the slip lines are wide enough for big numbers at phone, tablet and desktop widths
// (a 1,000 used to show as "00" because the unit suffix ate the box).
// Quantities: 1,000,000 from 768px up, 100,000 on a 360px phone. Weight: 100,000 kg.
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
});

for (const width of [360, 768, 1024, 1280]) {
  test(`big numbers fit in every quantity box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/farm/igp/new", "/farm/ogp/new", "/farm/sis/new"]) {
      await page.goto(path);
      const item = page.locator('[data-kind="item"]:visible').first();
      await item.fill("diesel");
      await page.locator('li[role="option"]:visible').first().click();
      const boxes = page.locator('input[name^="lines.0."][inputmode]:not([name$=".folio"]):visible');
      const count = await boxes.count();
      expect(count, path).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const box = boxes.nth(i);
        if (await box.evaluate((el: HTMLInputElement) => el.readOnly)) continue;
        const name = (await box.getAttribute("name")) ?? "";
        const big = name.endsWith(".weight") || width < 768 ? "100000" : "1000000";
        await box.fill(big);
        await box.blur();
        await expect(box).toHaveValue(Number(big).toLocaleString("en-US"));
        const overflow = await box.evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(overflow, `${path} ${name}`).toBeLessThanOrEqual(0);
      }
    }
  });
}
