// 360 px phone: slip lines as cards, item search as a full-screen sheet.
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
});

test("item search opens full screen and closes on pick", async ({ page }) => {
  await page.goto("/farm/sis/new");
  const input = page.locator('[data-kind="item"]').first();
  await input.tap();
  const sheet = input.locator("xpath=ancestor::div[contains(@class,'relative')][1]");
  await expect(sheet).toHaveCSS("position", "fixed");
  await input.fill("diesel");
  await page.locator('li[role="option"]').first().tap();
  await expect(sheet).toHaveCSS("position", "relative");
  await expect(page.locator('input[name="lines.0.item"]')).toHaveValue("diesel");
});

test("no horizontal scroll on slip screens", async ({ page }) => {
  for (const path of [
    "/farm",
    "/farm/igp/new",
    "/farm/ogp/new",
    "/farm/sis/new",
    "/farm/slips",
    "/farm/slips/AW02-SIS-0203",
    "/farm/stock",
    "/farm/stock/diesel",
    "/farm/stock-count/new",
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("return unused sheet fits a 360 px phone and works by touch", async ({ page }) => {
  await page.goto("/farm/slips/AW02-SIS-0203");
  await page.getByRole("button", { name: /Return unused/ }).tap();
  const sheet = page.locator("dialog[open]");
  await expect(sheet.locator('input[name="lines.0.qty"]')).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(360);
  const overflow = await sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await sheet.getByRole("button", { name: /Close/ }).tap();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("Feed All on a phone: the Bags box shows on the line card and takes a number", async ({ page }) => {
  await page.goto("/farm/ogp/new");
  const input = page.locator('[data-kind="item"]').first();
  await input.tap();
  await input.fill("feed all");
  await page.locator('li[role="option"]').first().tap();
  const bags = page.locator('input[name="lines.0.bags"]');
  await expect(bags).toBeVisible();
  await bags.tap();
  await bags.fill("12");
  await expect(bags).toHaveValue("12");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
