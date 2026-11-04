// C1 item search: English, Urdu, aliases, item number, spelling variants, recent items.
import { expect, test } from "@playwright/test";
import { fastMock } from "./helpers";

test.beforeEach(async ({ page }) => {
  await fastMock(page);
  await page.goto("/dev");
});

// Names are the client's item list (All Inventory Items By Names.xlsx), spellings included.
const cases: [string, string | RegExp][] = [
  ["belt a57", "Fan belt A57"],
  ["فین بیلٹ 57", "Fan belt A57"],
  ["1046", "Fan belt A-88"],
  ["ڈیزل", "Diesel Stock"],
  ["chian lock", /Ch(ai|ia)n Lock No\. ?60/],
  ["deisel", "Diesel Stock"],
  ["دستانے", "Glove"],
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
  await expect(page.locator('li[role="option"]').first()).toContainText("Virkon Spray");
});
