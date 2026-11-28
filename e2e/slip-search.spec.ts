// F6 My slips search (T04): besides slip No. and item, it finds what's written on the slip —
// remarks, M/s, Purpose of Use — and shows the matching text under the slip.
import { expect, test } from "@playwright/test";
import { today } from "@/lib/dates";
import { saveIGP, saveOGP, saveSIS } from "@/server/services/slips";
import { testFarm, testFarmUser, unique } from "./db";
import { signIn } from "./helpers";

const base = () => ({ date: today(), time: "12:00", preparedBy: "Test", idempotencyKey: unique() });

test("F6 search finds slips by remarks, Purpose of Use and M/s; Urdu letter variants match", async ({ page }) => {
  const farmId = await testFarm({ gloves: 10, drill: 2 });
  await testFarmUser(farmId);
  await saveIGP({
    ...base(), farmId, paperNo: "IGP-7001", remarks: "Broken tap replaced",
    source: { kind: "supplier", ms: "Hamza Traders" },
    lines: [{ itemId: "nylon-rope", qtyChallan: 1, qtyReceived: 1 }],
  });
  await saveSIS({ ...base(), farmId, paperNo: "SIS-7002", shedRows: [], lines: [{ itemId: "gloves", qty: 2, purpose: "Shed 3 repair" }] });
  // Remark typed with the Arabic ي / ك; searched with the Urdu ی / ک.
  await saveOGP({
    ...base(), farmId, paperNo: "OGP-7003", remarks: "پانی كی ٹينكی",
    to: { kind: "outside", ms: "Repair shop", reason: "repair" },
    lines: [{ itemId: "drill", qty: 1 }],
  });

  await signIn(page, { role: "farm", farmId });
  await page.goto("/farm/slips");
  const search = page.getByRole("searchbox");
  const rows = page.locator("main ul.card > li:visible");
  await expect(rows).toHaveCount(3);

  await search.fill("broken");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("IGP-7001");
  await expect(rows.first().locator("[data-match]")).toHaveText("Broken tap replaced");

  await search.fill("repair");
  // SIS by Purpose of Use, OGP by M/s "Repair shop".
  await expect(rows).toHaveCount(2);
  await expect(page.locator("main ul.card > li:visible", { hasText: "SIS-7002" }).locator("[data-match]")).toHaveText("Shed 3 repair");

  await search.fill("hamza");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("IGP-7001");

  await search.fill("ٹینکی");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("OGP-7003");

  // A No. match doesn't show a text line.
  await search.fill("7002");
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator("[data-match]")).toHaveCount(0);
});
