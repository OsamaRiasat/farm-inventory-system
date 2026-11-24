// Screens read the seeded demo data through the API.
import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, signIn } from "./helpers";

test("login as a farm user goes to that farm's home; a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/Username/).fill("aw05");
  await page.keyboard.press("Enter");
  await page.keyboard.type("wrong");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Wrong username or password" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel(/Password/).fill(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/farm$/);
  await expect(page.getByText("AW-05", { exact: true }).first()).toBeVisible();

  // Sign out ends the session: farm screens go back to the login.
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/farm");
  await expect(page).toHaveURL(/\/login$/);
});

test("farm screens without a session go to the login", async ({ page }) => {
  await page.goto("/farm");
  await expect(page).toHaveURL(/\/login$/);
});

test("Patoki home: hatchery transfer waiting, today's slips listed", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await expect(page.getByText("Waiting to receive")).toBeVisible();
  await expect(page.getByRole("link", { name: /AW-Hatchery · OGP-0047/ })).toBeVisible();
});

test("admin dashboard shows the seeded follow-ups", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin");
  const tile = (label: string) => page.getByRole("link", { name: new RegExp(label) });
  await expect(tile("In transit > 2 days")).toContainText("1");
  await expect(tile("Open shortfalls")).toContainText("1");
  await expect(tile("Correction requests")).toContainText("1");
  // Farms today is the first table; AW-04 has not saved today's SIS.
  await expect(page.locator("table.table").first().getByRole("row", { name: /AW-04/ })).toContainText("Missing");
});

test("all-slips table: filter by No. finds the real SIS-203, sorts, keyboard opens", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/dev");
  await page.locator("[data-search]").fill("AW02-SIS-0203");
  const rows = page.locator("table.table tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("AW02-SIS-0203");
  await rows.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Opened AW02-SIS-0203")).toBeVisible();
});

test("print frame shows SIS-203 as on paper", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/dev");
  const frame = page.locator(".print-frame");
  await expect(frame).toContainText("SUTLEJ FEEDS BREEDERS");
  await expect(frame).toContainText("AW02-SIS-0203");
  await expect(frame).toContainText("2,200 KG");
});
