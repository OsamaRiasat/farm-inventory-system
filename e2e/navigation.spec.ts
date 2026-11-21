// Back on every page except Home, and slips that never come back filled in (Back, forward, same link).
import { expect, test, type Page } from "@playwright/test";
import { fillPaperNo, signIn } from "./helpers";

const back = (page: Page) => page.locator("a[data-back]:visible");

test("farm: Back on every page except Home", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await expect(page.getByRole("link", { name: /Stock/ }).first()).toBeVisible();
  await expect(back(page)).toHaveCount(0);
  for (const path of [
    "/farm/slips",
    "/farm/slips/AW02-SIS-0203",
    "/farm/stock",
    "/farm/stock/diesel",
    "/farm/igp/new",
    "/farm/ogp/new",
    "/farm/sis/new",
    "/farm/stock-count/new",
  ]) {
    await page.goto(path);
    await expect(back(page), path).toHaveCount(1);
  }
});

test("admin: Back on every page except the dashboard", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin");
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(back(page)).toHaveCount(0);
  for (const path of [
    "/admin/slips",
    "/admin/slips/AW02-SIS-0203",
    "/admin/slips/new/igp",
    "/admin/stock",
    "/admin/stock/aw02/diesel",
    "/admin/transfers",
    "/admin/corrections",
    "/admin/reports/stock-on-hand",
    "/admin/audit",
    "/admin/setup/farms",
    "/admin/setup/items",
    "/admin/setup/users",
  ]) {
    await page.goto(path);
    await expect(back(page), path).toHaveCount(1);
  }
});

test("Back returns to the page you came from, without adding history", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await page.getByRole("link", { name: /Stock/ }).first().click();
  await expect(page).toHaveURL(/\/farm\/stock$/);
  await back(page).click();
  await expect(page).toHaveURL(/\/farm$/);
  // It was a real "back": forward goes to Stock again.
  await page.goForward();
  await expect(page).toHaveURL(/\/farm\/stock$/);
});

test("a page opened from a link: Back goes up to its list, and the phone's Back doesn't return to it", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await page.goto("/farm/slips/AW02-SIS-0203");
  await back(page).click();
  await expect(page).toHaveURL(/\/farm\/slips$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/farm$/);
});

test("a half-filled IGP left with Back is empty again: by forward, and by its link", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await page.locator('a[href="/farm/igp/new"]:visible').click();
  await fillPaperNo(page, "777");
  await page.locator('input[name="ms"]:visible').fill("Left behind");
  await page.locator('input[name="remarks"]:visible').fill("Left behind");
  await back(page).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Leave/ }).click();
  await expect(page).toHaveURL(/\/farm$/);

  await page.goForward();
  await expect(page).toHaveURL(/\/farm\/igp\/new$/);
  await expect(page.locator('input[name="paperNo"]:visible')).toHaveValue("");
  await expect(page.locator('input[name="ms"]:visible')).toHaveValue("");
  await expect(page.locator('input[name="remarks"]:visible')).toHaveValue("");

  await page.locator('input[name="ms"]:visible').fill("Again");
  await back(page).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Leave/ }).click();
  await page.locator('a[href="/farm/igp/new"]:visible').click();
  await expect(page.locator('input[name="ms"]:visible')).toHaveValue("");
});

test("stock count left half-done is empty again when you come back", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/stock");
  await page.locator('a[href="/farm/stock-count/new"]').click();
  const firstCount = page.locator("main input[inputmode]:visible").first();
  await firstCount.fill("12");
  await back(page).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Leave/ }).click();
  await expect(page).toHaveURL(/\/farm\/stock$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/farm\/stock-count\/new$/);
  await expect(page.locator("main input[inputmode]:visible").first()).toHaveValue("");
});

test("OGP Remarks: saved, printed on the pass, and the form starts empty again", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await page.locator('a[href="/farm/ogp/new"]:visible').click();
  await fillPaperNo(page, "9777");
  await page.locator('select[name="toFarm"]').selectOption("aw05");
  const item = page.locator('[data-kind="item"]').first();
  await item.fill("chips");
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await item.press("Enter");
  await page.keyboard.type("2");
  await page.locator('input[name="remarks"]:visible').fill("ڈرائیور کے ساتھ رسید بھیجی");
  await page.keyboard.press("Control+s");

  await expect(page).toHaveURL(/\/print\/AW02-OGP-\d{4}\?saved=1/);
  await expect(page.locator(".print-frame")).toContainText("Remarks");
  await expect(page.locator(".print-frame")).toContainText("ڈرائیور کے ساتھ رسید بھیجی");

  // The print view replaced the form, so Back goes to Home; a new OGP is empty.
  await page.goBack();
  await expect(page).toHaveURL(/\/farm$/);
  await page.locator('a[href="/farm/ogp/new"]:visible').click();
  await expect(page.locator('input[name="paperNo"]:visible')).toHaveValue("");
  await expect(page.locator('input[name="remarks"]:visible')).toHaveValue("");
});
