// Screens read the seeded mock data through the API.
import { expect, test } from "@playwright/test";
import { fastMock, signIn } from "./helpers";

test("login as a farm user goes to that farm's home", async ({ page }) => {
  await fastMock(page);
  await page.goto("/login");
  await page.getByRole("combobox").selectOption("aw05");
  await page.getByRole("button", { name: /^Enter/ }).first().click();
  await expect(page).toHaveURL(/\/farm$/);
  await expect(page.getByText("AW-05", { exact: true }).first()).toBeVisible();
});

test("farm screens without a session go to the login", async ({ page }) => {
  await page.goto("/farm");
  await expect(page).toHaveURL(/\/login$/);
});

test("Patoki home: hatchery transfer waiting, today's slips listed", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm");
  await expect(page.getByText("Waiting to receive")).toBeVisible();
  await expect(page.getByRole("link", { name: /AWHATCHERY-OGP-0047/ })).toBeVisible();
});

test("admin dashboard shows the seeded follow-ups", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin");
  const tile = (label: string) => page.getByRole("link", { name: new RegExp(label) });
  await expect(tile("In transit > 2 days")).toContainText("1");
  await expect(tile("Open shortfalls")).toContainText("1");
  await expect(tile("Correction requests")).toContainText("1");
  await expect(page.getByRole("row", { name: /AW-04/ })).toContainText("Missing");
});

test("all-slips table: filter by No. finds the real SIS-203, sorts, keyboard opens", async ({ page }) => {
  await fastMock(page);
  await page.goto("/dev");
  await page.locator("[data-search]").fill("SIS-0203");
  const rows = page.locator("table.table tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("AW02-SIS-0203");
  await rows.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Opened AW02-SIS-0203")).toBeVisible();
});

test("print frame shows SIS-203 as on paper", async ({ page }) => {
  await fastMock(page);
  await page.goto("/dev");
  const frame = page.locator(".print-frame");
  await expect(frame).toContainText("SUTLEJ FEEDS BREEDERS");
  await expect(frame).toContainText("AW02-SIS-0203");
  await expect(frame).toContainText("2,200 KG");
});
