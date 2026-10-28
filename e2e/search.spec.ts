// C1 item search: English, Urdu, aliases, item number, spelling variants, recent items.
import { expect, test } from "@playwright/test";
import { fastMock } from "./helpers";

test.beforeEach(async ({ page }) => {
  await fastMock(page);
  await page.goto("/dev");
});

const cases: [string, string][] = [
  ["belt 89", "Fan Belt 89A"],
  ["فین بیلٹ 57", "Fan Belt 57A"],
  ["193", "Fan Belt 89A"],
  ["ڈیزل", "Diesel Stock"],
  ["chian lock", "Chain Lock No.60 (half)"],
  ["deisel", "Diesel Stock"],
  ["دستانے", "Gloves"],
  ["tezab", "HCL"],
];

for (const [query, expected] of cases) {
  test(`"${query}" finds ${expected}`, async ({ page }) => {
    const input = page.locator('[data-kind="item"]').first();
    await input.fill(query);
    await expect(page.locator('li[role="option"]').first()).toContainText(expected);
  });
}

test("no match says so in both languages", async ({ page }) => {
  await page.locator('[data-kind="item"]').first().fill("zzzzqqq");
  await expect(page.getByText("No item found")).toBeVisible();
});

test("a picked item shows up under Recent next time", async ({ page }) => {
  const input = page.locator('[data-kind="item"]').first();
  await input.fill("virkon");
  await page.keyboard.press("Enter");
  await page.reload();
  await page.locator('[data-kind="item"]').first().focus();
  await expect(page.getByText("Recent")).toBeVisible();
  await expect(page.locator('li[role="option"]').first()).toContainText("Virkon S");
});
