// Farm User flows from the client's issue list (30 Oct 2026): fresh slips, Back, Find, export, slip dates.
import { expect, test, type Page } from "@playwright/test";
import { addDays, today } from "@/lib/dates";
import { fillPaperNo, focused, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
});

/** Home is ready for its keys (1 / 2 / 3, /) once its lists show. */
async function home(page: Page) {
  await expect(page).toHaveURL(/\/farm$/);
  await expect(page.getByText("Today's slips")).toBeVisible();
}

async function pickItem(page: Page, query: string) {
  const input = page.locator('[data-kind="item"]').first();
  await input.fill(query);
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await input.press("Enter");
}

test("a slip left without saving opens empty next time", async ({ page }) => {
  await page.goto("/farm");
  await home(page);
  await page.keyboard.press("1");
  await expect(page).toHaveURL(/\/farm\/igp\/new$/);
  await fillPaperNo(page, "458");
  await page.locator('input[name="biltyNo"]').fill("458");
  await page.getByRole("link", { name: /Back/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Leave/ }).click();
  await home(page);

  await page.keyboard.press("1");
  await expect(page).toHaveURL(/\/farm\/igp\/new$/);
  await expect(page.locator('input[name="paperNo"]')).toHaveValue("");
  await expect(page.locator('input[name="biltyNo"]')).toHaveValue("");
});

test("OGP saved → pass has New slip; Back goes Home, and Home is the end of Back", async ({ page }) => {
  await page.goto("/farm");
  await home(page);
  await page.keyboard.press("2");
  await fillPaperNo(page, "9123");
  await page.locator('select[name="toFarm"]').selectOption("aw05");
  await pickItem(page, "chips");
  await page.keyboard.type("1");
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/print\/.+\?saved=1/);

  await page.getByRole("link", { name: /New slip/ }).click();
  await expect(page).toHaveURL(/\/farm\/ogp\/new$/);
  await expect(page.locator('input[name="paperNo"]')).toHaveValue("");
  await expect(page.locator('select[name="toFarm"]')).toHaveValue("");

  // Back from the new slip: Home. One more browser Back must not reopen the pass or a slip form.
  await page.getByRole("link", { name: /Back/ }).click();
  await expect(page).toHaveURL(/\/farm$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/(print|farm\/(igp|ogp|sis))\//);
});

test("IGP then SIS saved: Back walks straight Home, not through each slip", async ({ page }) => {
  await page.goto("/farm");
  await home(page);
  await page.keyboard.press("1");
  await fillPaperNo(page, "9124");
  await page.locator('input[name="ms"]').fill("Test Supplier");
  await pickItem(page, "gloves");
  await page.keyboard.type("4");
  await page.keyboard.press("Enter");
  await page.keyboard.type("4");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "saved" })).toBeVisible();
  await page.getByRole("link", { name: /Back/ }).click();
  await home(page);

  await page.keyboard.press("3");
  await expect(page).toHaveURL(/\/farm\/sis\/new$/);
  await page.getByRole("link", { name: /Back/ }).click();
  await expect(page).toHaveURL(/\/farm$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/farm\/(igp|ogp|sis)\//);
});

test("Home Find: / focuses it; a paper No. or an item finds the slips, with the item's quantity", async ({ page }) => {
  await page.goto("/farm");
  await home(page);
  await page.keyboard.press("/");
  expect(await focused(page)).toBe("input");
  await page.keyboard.type("SIS-0203");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/farm\/slips\?q=SIS-0203$/);
  await expect(page.locator("ul.card li:visible")).toHaveCount(1);
  await expect(page.locator("ul.card li:visible").first()).toContainText("SIS-0203");

  await page.goto("/farm");
  await page.locator("#home-find").fill("drill");
  await page.getByRole("button", { name: /^Find/ }).click();
  await expect(page.locator("ul.card li:visible").first()).toContainText(/Drill Machine: [+−]\d/);
});

test("Excel: full stock report from Home, one item's report for a date range", async ({ page }) => {
  await page.goto("/farm");
  const [stock] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Excel/ }).click()]);
  expect(stock.suggestedFilename()).toMatch(/^AW-02-stock-\d{4}-\d{2}-\d{2}\.csv$/);

  await page.goto("/farm/stock/diesel");
  await page.getByRole("button", { name: /Last 7 days/ }).click();
  await expect(page.locator("tbody tr").last()).toContainText("Opening balance");
  const [card] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Excel/ }).click()]);
  expect(card.suggestedFilename()).toMatch(/Diesel-Stock.*\.csv$/);
});

test("slip date: arrival date can be changed; a future date is refused with the rule's words", async ({ page }) => {
  await page.goto("/farm/igp/new");
  await expect(page.getByText("Posted on")).toBeVisible();
  await expect(page.getByText("Arrival date")).toBeVisible();
  await expect(page.locator('input[name="date"]')).toHaveValue(today());
  await fillPaperNo(page, "9125");
  await page.locator('input[name="date"]').fill(addDays(today(), 1));
  await page.locator('input[name="ms"]').fill("Test Supplier");
  await pickItem(page, "gloves");
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await page.keyboard.type("2");
  await page.keyboard.press("Control+s");
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("Date can't be after today");

  // Two days back is fine; the slip shows that date and today's posting date.
  await page.locator('input[name="date"]').fill(addDays(today(), -2));
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "IGP-9125 saved" })).toBeVisible();
  await page.getByRole("link", { name: /View/ }).click();
  const frame = page.locator(".print-frame");
  await expect(frame).toContainText("Arrival date");
  await expect(frame).toContainText("Posted on");
});

test("a paper No. already used is refused under the No. box", async ({ page }) => {
  await page.goto("/farm/sis/new");
  await fillPaperNo(page, "0203");
  await pickItem(page, "gloves");
  await page.keyboard.type("1");
  await page.keyboard.press("Control+s");
  await page.locator("dialog[open]").getByRole("button", { name: /Confirm and save/ }).click();
  await expect(page.getByText("No. SIS-0203 is already saved. Check the number.").first()).toBeVisible();
});
