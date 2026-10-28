// Keyboard-first entry on the slip screens (docs/kb/05-keyboard-entry.md).
import { expect, test } from "@playwright/test";
import { focused, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
});

test("OGP: item search → qty → weight → new line → Save, without the mouse", async ({ page }) => {
  await page.goto("/farm/ogp/new");
  const item = page.locator('[data-kind="item"]').first();
  await item.focus();
  await page.keyboard.type("belt 89");
  await expect(page.locator('li[role="option"]').first()).toContainText("Fan Belt 89A");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[name="lines.0.item"]')).toHaveValue("fan-belt-89a");
  expect(await focused(page)).toBe("lines.0.qty");

  await page.keyboard.type("300");
  await expect(page.getByText(/Only \d+ in stock/)).toBeVisible();
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("lines.0.weight");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[name$=".item"]')).toHaveCount(2);
  expect(await focused(page)).toBe("item");
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("save");
});

test("Alt+N adds a line, Alt+Backspace removes it", async ({ page }) => {
  await page.goto("/farm/ogp/new");
  await page.locator('input[name="lines.0.qty"]').focus();
  await page.keyboard.press("Alt+KeyN");
  await expect(page.locator('input[name$=".item"]')).toHaveCount(2);
  await page.keyboard.press("Alt+Backspace");
  await expect(page.locator('input[name$=".item"]')).toHaveCount(1);
});

test("IGP header: Enter moves Bilty → Truck → Driver", async ({ page }) => {
  await page.goto("/farm/igp/new");
  await page.locator('input[name="biltyNo"]').focus();
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("truckNo");
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("driverName");
});

test("SIS: Ctrl+S shows before → after from live stock, focus on Confirm, Esc closes", async ({ page }) => {
  await page.goto("/farm/sis/new");
  await page.locator('[data-kind="item"]').first().focus();
  await page.keyboard.type("diesel");
  await page.keyboard.press("Enter");
  await page.keyboard.type("5");
  await page.keyboard.press("Control+s");
  const sheet = page.locator("dialog[open]");
  await expect(sheet).toContainText("Diesel Stock");
  await expect(sheet).toContainText(/→/);
  await expect(sheet.getByRole("button", { name: /Confirm and save/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("Receive transfer: Received all, more than sent is blocked, less is amber", async ({ page }) => {
  await page.goto("/farm");
  await page.getByRole("link", { name: /AWHATCHERY-OGP/ }).click();
  await page.getByRole("button", { name: /Received all/ }).click();
  const trays = page.locator('input[name="lines.0.qtyReceived"]');
  await expect(trays).toHaveValue("9,000");
  await trays.fill("9500");
  await expect(page.getByText("Cannot receive more than 9,000")).toBeVisible();
  await trays.fill("8997");
  await expect(page.getByText("Short by 3")).toBeVisible();
});

test("home keys: 3 opens SIS, ? lists shortcuts, g s goes to Slips", async ({ page }) => {
  await page.goto("/farm");
  await expect(page.getByText("Today's slips")).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.locator("dialog[open]")).toContainText("Keyboard shortcuts");
  await page.keyboard.press("Escape");
  await page.keyboard.press("3");
  await expect(page).toHaveURL(/\/farm\/sis\/new$/);
  await page.goto("/farm");
  await expect(page.getByText("Today's slips")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page).toHaveURL(/\/farm\/slips$/);
});
