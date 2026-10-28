import type { Page } from "@playwright/test";

/** Signs in (mock session) and removes the API delay, before the page loads. */
export async function signIn(page: Page, session: { role: "farm"; farmId: string } | { role: "admin" }) {
  const value =
    session.role === "farm"
      ? { role: "farm", farmId: session.farmId, userName: `${session.farmId} Store Keeper` }
      : { role: "admin", userName: "Accounts Admin" };
  await page.addInitScript((s) => {
    sessionStorage.setItem("awfarms.session", JSON.stringify(s));
    localStorage.setItem("awfarms.mock.options", JSON.stringify({ latencyMs: 0, failSaves: false }));
  }, value);
}

export async function fastMock(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("awfarms.mock.options", JSON.stringify({ latencyMs: 0, failSaves: false }));
  });
}

/** Name or kind of the focused element, for keyboard-flow checks. */
export function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    return el.getAttribute("name") || el.dataset.kind || (el.hasAttribute("data-save") ? "save" : el.tagName.toLowerCase());
  });
}
