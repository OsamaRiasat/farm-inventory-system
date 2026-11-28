// Daily Report (T07): the Farm Home button, the keyboard path, rules shown on the form, and the Admin's view.
import { expect, test } from "@playwright/test";
import { addDays, today } from "@/lib/dates";
import { saveDR } from "@/server/services/slips";
import { stock, testFarm, testFarmUser, unique } from "./db";
import { focused, signIn } from "./helpers";

test("Farm Home: Daily Report sits with IGP / OGP / SIS; key 4 opens it", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  const buttons = page.locator("main nav a:visible");
  await expect(buttons).toHaveCount(4);
  await expect(buttons.nth(3)).toContainText("Daily Report");
  await expect(buttons.nth(3)).toContainText("روزانہ رپورٹ");
  await expect(buttons.nth(3)).toHaveAttribute("href", "/farm/dr/new");
  await page.keyboard.press("4");
  await expect(page).toHaveURL(/\/farm\/dr\/new$/);
  await expect(page.locator('input[name="eggsReceived"]:visible')).toBeVisible();
});

test("Daily Report by keyboard: No. → date → eggs → trays → Remarks → Save; live eggs to stock; one per date", async ({ page }) => {
  const farmId = await testFarm();
  await testFarmUser(farmId);
  await signIn(page, { role: "farm", farmId });
  await page.goto("/farm/dr/new");

  await expect.poll(() => focused(page)).toBe("paperNo");
  await page.keyboard.type("0101");
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("date");
  await page.keyboard.press("Enter");
  const steps: [string, string][] = [
    ["eggsReceived", "10000"],
    ["hatchingEggs", "8000"],
    ["marketEggs", "1200"],
    ["discardedEggs", "50"],
    ["gattaTray", "340"],
    ["plasticTray", "12"],
    ["eggsBox", "23"],
  ];
  for (const [name, value] of steps) {
    expect(await focused(page)).toBe(name);
    await page.keyboard.type(value);
    await page.keyboard.press("Enter");
  }
  const toStock = page.locator("[data-to-stock]:visible");
  await expect(toStock).toContainText("750");
  expect(await focused(page)).toBe("remarks");
  await page.keyboard.type("شیڈ 2 کے انڈے");
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("save");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "DR-0101 saved" })).toBeVisible();
  await expect.poll(() => stock(farmId, "eggs")).toBe(750);

  // Same date again: refused in the browser with the server's words, nothing saved.
  await page.locator('input[name="paperNo"]:visible').fill("0102");
  await page.locator('input[name="eggsReceived"]:visible').fill("100");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("alert").filter({ hasText: /A Daily Report for .* is already saved \(DR-0101\)/ })).toBeVisible();
  expect(await stock(farmId, "eggs")).toBe(750);
});

test("Daily Report: Hatching + Market + Discarded over Total shows red at once and isn't saved", async ({ page }) => {
  const farmId = await testFarm();
  await testFarmUser(farmId);
  await signIn(page, { role: "farm", farmId });
  await page.goto("/farm/dr/new");
  await page.locator('input[name="paperNo"]:visible').fill("0201");
  await page.locator('input[name="eggsReceived"]:visible').fill("1000");
  await page.locator('input[name="hatchingEggs"]:visible').fill("900");
  await page.locator('input[name="marketEggs"]:visible').fill("200");
  await expect(page.locator("[data-to-stock]:visible")).toContainText("Hatching + Market + Discarded (1,100) is more than Total Eggs Received (1,000)");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("alert").filter({ hasText: "(1,100) is more than Total Eggs Received (1,000)" })).toBeVisible();
  expect(await stock(farmId, "eggs")).toBe(0);
});

test("Admin: Daily Report in the type filter, detail shows every field + eggs to stock, no Correct; print", async ({ page }) => {
  const farmId = await testFarm();
  const paperNo = `DR-${Date.now().toString().slice(-7)}`;
  const slip = await saveDR({
    date: addDays(today(), -1), time: "17:10", preparedBy: "Test", idempotencyKey: unique(), farmId, paperNo,
    eggsReceived: 5000, hatchingEggs: 4000, marketEggs: 300, discardedEggs: 20, gattaTray: 170, plasticTray: 9, eggsBox: 12,
    remarks: "Admin view test",
  });
  await signIn(page, { role: "admin" });
  await page.goto("/admin/slips");
  await page.locator("select").filter({ hasText: "All types" }).selectOption("DR");
  await page.locator('input[type="search"]').first().fill(paperNo);
  await expect(page.getByRole("row").filter({ hasText: paperNo })).toBeVisible();

  await page.goto(`/admin/slips/${encodeURIComponent(slip.id)}`);
  const body = page.locator("article.print-frame:visible");
  await expect(body).toContainText("Daily Report");
  for (const [label, n] of [
    ["Total Eggs Received", "5,000"],
    ["Hatching Eggs", "4,000"],
    ["Market Eggs", "300"],
    ["Discarded Eggs", "20"],
    ["Eggs added to stock", "680"],
    ["Gatta Tray", "170"],
    ["Plastic Tray", "9"],
    ["Eggs Box", "12"],
  ]) {
    await expect(body.locator("tr", { hasText: label })).toContainText(n);
  }
  await expect(body).toContainText("Admin view test");
  await expect(page.getByRole("button", { name: /Correct/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Cancel slip/ })).toBeVisible();

  await page.goto(`/print/${encodeURIComponent(slip.id)}`);
  await expect(page.locator("article.print-frame")).toContainText("Eggs added to stock");
  await expect(page.locator("article.print-frame")).toContainText(paperNo);
});
