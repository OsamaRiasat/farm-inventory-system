// Client issue list rows 20–30 (24–25 Nov 2026), see docs/client-issues.md.
import { expect, test } from "@playwright/test";
import { addDays, today } from "@/lib/dates";
import { fillPaperNo, focused, signIn, userPage } from "./helpers";
import { unique } from "./db";

test.beforeEach(async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
});

const itemBox = (page: import("@playwright/test").Page) => page.locator('[data-kind="item"]:visible').first();

test("#20 item search: ↓ / ↑ move a solid highlight, Enter picks the highlighted item", async ({ page }) => {
  await page.goto("/farm/igp/new");
  await itemBox(page).fill("ther");
  const options = page.locator('li[role="option"]');
  await expect(options.nth(2)).toBeVisible();
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  // Solid green, readable at a glance.
  await expect(options.nth(1)).toHaveCSS("background-color", "rgb(31, 107, 74)");
  const name = (await options.nth(1).locator(".font-medium").textContent())!.trim();
  await page.keyboard.press("Enter");
  await expect(itemBox(page)).toHaveValue(name);
  await expect(page.locator('input[name="lines.0.item"]')).not.toHaveValue("");
  expect(await focused(page)).toBe("lines.0.qtyChallan");
});

test("#22 Tab without picking an item stays in item search; Tab on a highlighted match picks it", async ({ page }) => {
  await page.goto("/farm/igp/new");
  await itemBox(page).fill("zzqx nothing");
  await expect(page.getByText("No item found")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe("item");
  await expect(page.locator('input[name="lines.0.item"]')).toHaveValue("");

  await itemBox(page).fill("gloves");
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator('input[name="lines.0.item"]')).not.toHaveValue("");
  expect(await focused(page)).toBe("lines.0.qtyChallan");
});

test("#21 #24 decimals for a Qty item; received more than the challan is a warning, still saved", async ({ page }) => {
  await page.goto("/farm/igp/new");
  await fillPaperNo(page, "9721");
  await page.locator('input[name="ms"]').fill("Test Supplier");
  await itemBox(page).fill("gloves");
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("0.5");
  await expect(page.locator('input[name="lines.0.qtyChallan"]')).toHaveValue("0.5");
  await page.keyboard.press("Enter");
  await page.keyboard.type("61");
  await expect(page.getByText("60.5 more than the challan")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "IGP-9721 saved" })).toBeVisible();
});

test("#27 the next slip starts on the last slip's date (old-month posting), marked Not today", async ({ page }) => {
  const old = addDays(today(), -40);
  await page.goto("/farm/sis/new");
  await expect(page.locator('input[name="date"]')).toHaveValue(today());
  await fillPaperNo(page, "9727");
  await page.locator('input[name="date"]').fill(old);
  await expect(page.getByText("Not today's date")).toBeVisible();
  await itemBox(page).fill("gloves");
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("1");
  await page.keyboard.press("Control+s");
  await page.locator("dialog[open]").getByRole("button", { name: /Confirm/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "SIS-9727 saved" })).toBeVisible();

  await expect(page.locator('input[name="date"]')).toHaveValue(old);
  await page.goto("/farm/igp/new");
  await expect(page.locator('input[name="date"]')).toHaveValue(old);
  await expect(page.getByText("Not today's date")).toBeVisible();
});

test("#30 farm requests a new item from IGP; it appears only after the Admin approves it", async ({ page, browser, baseURL }) => {
  const name = unique("Qzvx"); // matches nothing, not even fuzzily
  await page.goto("/farm/igp/new");
  await itemBox(page).fill(name);
  await expect(page.getByText("Press Enter to request it")).toBeVisible();
  await page.keyboard.press("Enter");

  const dialog = page.locator("dialog[open]");
  await expect(dialog.locator('input[name="name"]')).toHaveValue(name);
  await expect(dialog.locator('input[name="name"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.type("زیبرا پائپ");
  await page.keyboard.press("Enter");
  await dialog.locator('select[name="category"]').selectOption("Shed Items");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(`Request sent for ${name}`)).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(await focused(page)).toBe("item");
  // Not in the list yet; the slip itself wasn't touched.
  await itemBox(page).fill(name);
  await expect(page.getByText("No item found")).toBeVisible();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);

  const admin = await userPage(browser, baseURL, { role: "admin" });
  await admin.goto("/admin");
  await expect(admin.getByRole("link", { name: /New item requests/ })).toBeVisible();
  await admin.getByRole("link", { name: /New item requests/ }).click();
  await expect(admin).toHaveURL(/\/admin\/setup\/items\?show=requested$/);
  await admin.getByRole("cell", { name }).click();
  const drawer = admin.getByRole("dialog");
  await expect(drawer).toContainText("New item request");
  await drawer.getByRole("button", { name: /Approve and add/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(admin.getByRole("cell", { name })).toHaveCount(0);

  // The farm finds it now (item list refreshes on reload).
  await page.reload();
  await itemBox(page).fill(name);
  await expect(page.locator('li[role="option"]').first()).toContainText(name);
});

test("#30 the + beside item search is for the farm only", async ({ page, browser, baseURL }) => {
  await page.goto("/farm/ogp/new");
  await expect(page.getByRole("button", { name: "Request a new item" }).first()).toBeVisible();
  const admin = await userPage(browser, baseURL, { role: "admin" });
  await admin.goto("/admin/slips/new/ogp");
  const farm = admin.locator('select[name="entryFarm"]');
  await farm.selectOption("aw02");
  await farm.press("Enter");
  await expect(admin.getByTestId("entry-farm")).toContainText("AW-02");
  await expect(admin.locator('[data-kind="item"]:visible').first()).toBeVisible();
  await expect(admin.getByRole("button", { name: "Request a new item" })).toHaveCount(0);
});
