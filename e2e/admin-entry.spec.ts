// The Accounts Admin enters a paper slip received from a farm: New slip on A2 → type → farm → the farm's own form.
import { expect, test, type Page } from "@playwright/test";
import { fillPaperNo, focused, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, { role: "admin" });
});

async function pickItem(page: Page, query: string) {
  const input = page.locator('[data-kind="item"]').first();
  await input.fill(query);
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await input.press("Enter");
}

test("New slip by keyboard: menu → IGP → choose farm → save; Prepared by is the admin, the slip is the farm's", async ({ page }) => {
  await page.goto("/admin/slips");
  const menu = page.getByRole("button", { name: /New slip/ });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await expect(menu).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown"); // OGP
  await page.keyboard.press("ArrowUp"); // back to IGP
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/slips\/new\/igp$/);

  // No farm in the top bar: choose it first.
  const farm = page.locator('select[name="entryFarm"]');
  await expect(farm).toBeFocused();
  await farm.selectOption("aw05");
  await farm.press("Enter");
  await expect(page.getByTestId("entry-farm")).toHaveText("AW-05");

  await fillPaperNo(page, "7701");
  await page.locator('input[name="ms"]').fill("Test Supplier");
  await pickItem(page, "gloves");
  await page.keyboard.type("5");
  await page.keyboard.press("Enter");
  await page.keyboard.type("5");
  await expect(page.locator("form").getByText("Accounts Admin")).toBeVisible();
  await page.keyboard.press("Control+s");

  const banner = page.getByRole("status").filter({ hasText: "saved" });
  await expect(banner).toContainText("IGP-7701 saved");
  await banner.getByRole("link", { name: /View/ }).click();
  await expect(page).toHaveURL(/\/admin\/slips\/AW05-IGP-\d{4}/);
  await expect(page.getByText("Accounts Admin").first()).toBeVisible();
});

test("farm picked in the top bar is used straight away, and its stock rules apply", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("awfarms.adminFarm", "aw05"));
  await page.goto("/admin/slips/new/ogp");
  await expect(page.getByTestId("entry-farm")).toHaveText("AW-05");
  await expect(page.locator('select[name="entryFarm"]')).toHaveCount(0);
  // Can't send to its own farm.
  await expect(page.locator('select[name="toFarm"] option[value="aw05"]')).toHaveCount(0);

  await pickItem(page, "drill");
  expect(await focused(page)).toBe("lines.0.qty");
  await page.keyboard.type("500");
  await expect(page.getByText(/Only \d+ in stock/)).toBeVisible();
});

test("Change farm with typed data asks first, then starts again from the farm choice", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("awfarms.adminFarm", "aw02"));
  await page.goto("/admin/slips/new/sis");
  await expect(page.getByTestId("entry-farm")).toHaveText(/AW-02/);
  await fillPaperNo(page, "55");

  await page.getByRole("button", { name: /Change farm/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Stay/ }).click();
  await expect(page.locator('input[name="paperNo"]')).toHaveValue("55");

  await page.getByRole("button", { name: /Change farm/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Leave/ }).click();
  await page.locator('select[name="entryFarm"]').selectOption("aw05");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByTestId("entry-farm")).toHaveText("AW-05");
  await expect(page.locator('input[name="paperNo"]')).toHaveValue("");
});

test("stock count entered by the admin for a farm", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("awfarms.adminFarm", "aw05"));
  await page.goto("/admin/slips/new/count");
  await page.getByLabel(/^Drill Machine — Counted/).fill("3");
  await page.getByLabel(/Reason for the differences/).fill("Monthly count");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Stock count AW05-CNT-\d{4} saved/)).toBeVisible();
});
