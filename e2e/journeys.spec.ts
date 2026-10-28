// Whole tasks across screens: save for real, transfers between farms, corrections, stock count, admin.
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Quantity on the item's stock card (F9) at the signed-in farm. */
async function stockOf(page: Page, itemId: string) {
  await page.goto(`/farm/stock/${itemId}`);
  const text = await page.locator(".text-3xl").first().innerText();
  return Number(text.split(" ")[0].replace(/,/g, ""));
}

async function pickItem(page: Page, query: string, row = 0) {
  const input = page.locator('[data-kind="item"]').nth(row);
  await input.fill(query);
  await expect(page.locator('li[role="option"]').first()).toBeVisible();
  await input.press("Enter");
}

test("IGP saves for real: real number, form clears, stock goes up by Qty Actual Received", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  const before = await stockOf(page, "nylon-rope");

  await page.goto("/farm/igp/new");
  await page.locator('input[name="biltyNo"]').fill("3874");
  await page.locator('input[name="ms"]').fill("Test Supplier");
  await pickItem(page, "nylon rope");
  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  await page.keyboard.type("7");
  await expect(page.getByText("Short by 3")).toBeVisible();
  await page.keyboard.press("Control+s");

  const banner = page.getByRole("status").filter({ hasText: "saved" });
  await expect(banner).toContainText(/AW02-IGP-\d{4} saved/);
  await expect(page.locator('input[name="biltyNo"]')).toHaveValue("");
  expect(await stockOf(page, "nylon-rope")).toBe(before + 7);
});

test("SIS: summary sheet, Confirm with Enter, stock goes down", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  const before = await stockOf(page, "diesel");
  await page.goto("/farm/sis/new");
  await page.locator('input[name="shed.0.feedKg"]').fill("100");
  await pickItem(page, "diesel");
  await page.keyboard.type("5");
  await page.keyboard.press("Control+s");
  await expect(page.locator("dialog[open]")).toContainText("Diesel Stock");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "saved" })).toContainText(/AW02-SIS-\d{4} saved/);
  expect(await stockOf(page, "diesel")).toBe(before - 5);
});

test("save errors show in a banner and under the field; nothing is saved", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/ogp/new");
  await page.keyboard.press("Control+s");
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toContainText("Not saved. Please fix:");
  await expect(alert).toContainText("Pick a farm");
  await expect(alert).toContainText("Add at least one item");
  await expect(page.locator("label").filter({ hasText: "Farm" }).getByText("Pick a farm", { exact: true })).toBeVisible();
});

test("Not saved: red banner, everything typed stays", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.addInitScript(() => localStorage.setItem("awfarms.mock.options", JSON.stringify({ latencyMs: 0, failSaves: true })));
  await page.goto("/farm/igp/new");
  await page.locator('input[name="biltyNo"]').fill("555");
  await page.locator('input[name="ms"]').fill("X");
  await pickItem(page, "gloves");
  await page.keyboard.type("4");
  await page.keyboard.press("Control+s");
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("Not saved. Check internet and tap Save again.");
  await expect(page.locator('input[name="biltyNo"]')).toHaveValue("555");
  await expect(page.locator('input[name="lines.0.qtyChallan"]')).toHaveValue("4");
});

test("leaving a half-filled slip asks first; Stay keeps it", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/igp/new");
  await page.locator('input[name="biltyNo"]').fill("99");
  await page.getByRole("link", { name: /Back/ }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Leave without saving?");
  await expect(dialog.getByRole("button", { name: /Stay/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('input[name="biltyNo"]')).toHaveValue("99");
  await page.getByRole("link", { name: /Back/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Leave/ }).click();
  await expect(page).toHaveURL(/\/farm$/);
});

test("transfer end to end: AW-02 sends, print has the QR, AW-05 receives short, admin writes it off", async ({ context }) => {
  const sender = await context.newPage();
  await signIn(sender, { role: "farm", farmId: "aw02" });
  await sender.goto("/farm/ogp/new");
  await sender.locator('select[name="toFarm"]').selectOption("aw05");
  await sender.locator('input[name="driverName"]').fill("Ameen");
  await pickItem(sender, "chips");
  await sender.keyboard.type("10");
  await sender.keyboard.press("Control+s");

  // OGP goes straight to the print view; the QR opens the waiting receipt at AW-05.
  await expect(sender).toHaveURL(/\/print\/AW02-OGP-\d{4}\?saved=1/);
  const no = decodeURIComponent(sender.url().match(/print\/([^?]+)/)![1]);
  await expect(sender.locator(".print-frame")).toContainText(no);
  await expect(sender.locator("[data-qr]")).toHaveAttribute("data-qr", new RegExp(`/farm/igp/receive/T-${no}$`));

  const receiver = await context.newPage();
  await signIn(receiver, { role: "farm", farmId: "aw05" });
  await receiver.goto("/farm");
  await receiver.getByRole("link", { name: new RegExp(no) }).click();
  await receiver.locator('input[name="lines.0.qtyReceived"]').fill("8");
  await receiver.keyboard.press("Control+s");
  await expect(receiver).toHaveURL(/\/farm\/slips\/AW05-IGP-\d{4}\?saved=1/);
  await expect(receiver.getByText("Short by 2")).toBeVisible();

  const admin = await context.newPage();
  await signIn(admin, { role: "admin" });
  await admin.goto("/admin/transfers");
  await admin.getByRole("row", { name: new RegExp(no) }).click();
  await admin.getByLabel(/Reason/).fill("Two bags torn on the way");
  await admin.getByRole("button", { name: /Write off the shortfall/ }).click();
  await expect(admin.getByText("Written off: Two bags torn on the way").first()).toBeVisible();
});

test("correction request: farm asks, admin approves pre-filled, original marked corrected", async ({ context }) => {
  const farm = await context.newPage();
  await signIn(farm, { role: "farm", farmId: "aw02" });
  await farm.goto("/farm/slips");
  await farm.getByRole("button", { name: "SIS", exact: true }).click();
  await farm.locator("ul.card a").first().click();
  const slipUrl = farm.url();
  await farm.getByRole("button", { name: /Request correction/ }).click();
  const dialog = farm.locator("dialog[open]");
  // Ask for one less than the line has now (or one more if it has 1), so the request is a real change.
  const current = Number((await dialog.locator("select option").first().innerText()).split("—")[1].replace(/,/g, "").trim());
  await dialog.locator(".input-wrap input").fill(String(current > 1 ? current - 1 : current + 1));
  await dialog.locator("textarea").fill("Wrote it twice");
  await dialog.getByRole("button", { name: /Send request/ }).click();
  await expect(farm.getByText("Request sent to the Accounts Admin")).toBeVisible();

  const admin = await context.newPage();
  await signIn(admin, { role: "admin" });
  await admin.goto("/admin/corrections");
  await admin.getByRole("row", { name: /Wrote it twice/ }).getByRole("link", { name: /Approve/ }).click();
  const panel = admin.locator("form").filter({ has: admin.getByRole("button", { name: /Save correction/ }) });
  await expect(panel.getByLabel(/Reason/)).toHaveValue("Wrote it twice");
  await expect(panel.locator("tr.bg-primary-soft")).toHaveCount(1);
  await admin.getByRole("button", { name: /Save correction/ }).click();
  await expect(admin.getByText(/Correction saved as AW02-SIS-\d{4}-C1/)).toBeVisible();

  await farm.goto(slipUrl);
  await expect(farm.getByText(/Corrected on .* by Accounts Admin\. Reason: Wrote it twice/)).toBeVisible();
});

test("admin cancels a slip with a reason; stamp and banner show", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin/slips");
  await page.getByLabel(/Type/).selectOption("IGP");
  await page.locator("table.table tbody tr").first().click();
  await page.getByRole("button", { name: /Cancel slip/ }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.getByRole("button", { name: /Keep it/ })).toBeFocused();
  await dialog.getByLabel(/Reason/).fill("Entered at the wrong farm");
  await dialog.getByRole("button", { name: /Cancel the slip/ }).click();
  await expect(page.getByText(/Cancelled on .* Reason: Entered at the wrong farm/)).toBeVisible();
  await expect(page.locator(".print-frame")).toContainText("CANCELLED");
});

test("stock count: counted quantity replaces the system's, with a reason", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/stock-count/new");
  await page.getByLabel(/Brush \(Coconut\/Plastic\) — Counted/).fill("3");
  await page.getByLabel(/Reason for the differences/).fill("Monthly count");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Stock count AW02-CNT-\d{4} saved/)).toBeVisible();
  expect(await stockOf(page, "brush")).toBe(3);
});

test("my slips: search by item and by number", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/slips");
  await page.locator("[data-search]").fill("0203");
  await expect(page.locator("ul.card li")).toHaveCount(1);
  await page.locator("[data-search]").fill("drill");
  await expect(page.locator("ul.card li").first()).toContainText(/OGP|IGP/);
});

test("admin stock: All Farms = sum of the farm columns", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin/stock");
  const row = page.getByRole("row", { name: /^Diesel Stock/ });
  const cells = await row.locator("td").allInnerTexts();
  const nums = cells.slice(1).map((c) => Number(c.replace(/,/g, "")));
  const [total] = nums.slice(-2);
  const farms = nums.slice(0, -2);
  expect(farms.reduce((a, b) => a + b, 0)).toBe(total);
});

test("reports: feed & mortality chart for one farm, gate register filter, audit log lists saves", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.addInitScript(() => sessionStorage.setItem("awfarms.adminFarm", "aw02"));
  await page.goto("/admin/reports/feed-mortality");
  await expect(page.getByRole("img", { name: /Daily mortality per shed/ })).toBeVisible();
  await expect(page.locator("table.table tbody tr").first()).toContainText("Shed");

  await page.goto("/admin/reports/gate-register");
  await page.getByLabel(/Type/).selectOption("OGP");
  await expect(page.locator("table.table tbody tr").first()).toContainText("OGP");

  await page.goto("/admin/audit");
  await expect(page.locator("table.table tbody tr").first()).toBeVisible();
});

test("setup: add a shed and an item; both appear in the audit log", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin/setup/farms");
  const card = page.locator("section").filter({ hasText: "AW-04" }).first();
  await card.getByLabel(/New shed name/).fill("Shed 9");
  await card.getByRole("button", { name: /Add shed/ }).click();
  await expect(card.getByText("Shed 9")).toBeVisible();

  await page.goto("/admin/setup/items");
  await page.getByRole("button", { name: /Add item/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel(/Name \(English\)/).fill("Test Bucket");
  await drawer.getByLabel(/Name \(Urdu\)/).fill("بالٹی");
  await drawer.getByLabel(/^Category/).fill("Shed Items");
  await drawer.getByRole("button", { name: /Save/ }).click();
  await page.locator("[data-search]").fill("bucket");
  await expect(page.getByRole("row", { name: /Test Bucket/ })).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("row", { name: /Test Bucket/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Shed 9/ })).toBeVisible();
});
