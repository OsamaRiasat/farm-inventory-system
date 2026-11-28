// Excel downloads are real .xlsx files: opened here with exceljs to check the layout (T06).
import { expect, test, type Download, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { signIn } from "./helpers";

async function open(download: Download) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await download.path());
  const ws = wb.worksheets[0];
  const rows: { n: number; values: unknown[] }[] = [];
  ws.eachRow((row, n) => rows.push({ n, values: (row.values as unknown[]).slice(1) }));
  const merges = (ws.model as { merges?: string[] }).merges ?? [];
  return { ws, rows, merges };
}

async function download(page: Page, button: RegExp) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button }).click()]);
  return file;
}

test("farm stock Excel: grouped by category (merged rows), no Category column, same items as the screen", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/stock");
  const list = page.locator("ul.card > li:visible");
  await expect(list.first()).toBeVisible();
  const onScreen = await list.count();
  const diesel = list.filter({ hasText: "Diesel Stock" }).first();
  const dieselQty = Number((await diesel.locator(".num .text-lg").innerText()).replace(/,/g, ""));

  const file = await download(page, /Excel/);
  expect(file.suggestedFilename()).toMatch(/^AW-02-stock-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const { rows, merges, ws } = await open(file);

  expect(rows[0].values[0]).toContain("Patoki");
  const header = rows.find((r) => r.values[0] === "Item No.")!;
  expect(header.values).toEqual(["Item No.", "Item", "Item (Urdu)", "In stock", "Unit"]);
  expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: header.n });

  const body = rows.filter((r) => r.n > header.n);
  const groups = body.filter((r) => merges.includes(`A${r.n}:E${r.n}`));
  const items = body.filter((r) => !merges.includes(`A${r.n}:E${r.n}`));
  expect(groups.length).toBeGreaterThan(1);
  expect(items.length).toBe(onScreen);
  // Categories A–Z.
  const names = groups.map((g) => String(g.values[0]));
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  const dieselRow = items.find((r) => r.values[1] === "Diesel Stock")!;
  expect(dieselRow.values[3]).toBe(dieselQty);
  expect(dieselRow.values[4]).toBe("LTR");
});

test("stock card Excel: header block, opening row, bold total; feed gets a Bags column", async ({ page }) => {
  await signIn(page, { role: "farm", farmId: "aw02" });
  await page.goto("/farm/stock/feed-all");
  await page.getByRole("button", { name: /Last 7 days/ }).click();
  await expect(page.locator("tbody tr").last()).toContainText("Opening balance");
  const { rows, ws } = await open(await download(page, /Excel/));
  expect(String(rows[0].values[0])).toContain("Feed All");
  const header = rows.find((r) => r.values[0] === "Date")!;
  expect(header.values).toEqual(["Date", "No.", "Type", "In (KG)", "Out (KG)", "Bags", "In stock (KG)"]);
  expect(rows[rows.length - 1].values[1]).toBe("Total");
  expect(ws.getRow(rows[rows.length - 1].n).getCell(2).font?.bold).toBe(true);
  expect(rows.some((r) => r.values[1] === "Opening balance")).toBe(true);
  // Feed deliveries carry their bags.
  for (const r of rows.filter((r) => r.values[2] === "IGP")) expect(typeof r.values[5], String(r.values[1])).toBe("number");
});

test("admin report Excel: the button works; stock on hand is grouped by category", async ({ page }) => {
  await signIn(page, { role: "admin" });
  await page.goto("/admin/reports/stock-on-hand");
  await expect(page.getByText(/rows|\d+ row/).first()).toBeVisible();
  const { rows, merges } = await open(await download(page, /Excel/));
  expect(rows[0].values[0]).toBe("Stock on hand");
  const header = rows.find((r) => r.values[0] === "Item")!;
  expect(header.values).not.toContain("Category");
  const last = String.fromCharCode(64 + header.values.length);
  expect(merges.some((m) => m.endsWith(`:${last}${m.match(/\d+/)![0]}`) && Number(m.match(/\d+/)![0]) > header.n)).toBe(true);
});
