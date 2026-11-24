import type { Browser, Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo1234";

/** Signs in through the API (the demo seed's logins); the session cookie is shared by the page's context. */
export async function signIn(page: Page, session: { role: "farm"; farmId: string } | { role: "admin" }) {
  const username = session.role === "farm" ? session.farmId : "admin";
  const res = await page.request.post("/api/auth/login", { data: { username, password: DEMO_PASSWORD } });
  if (!res.ok()) throw new Error(`Sign-in as ${username} failed: ${res.status()}`);
}

/** A page in its own browser context: needed when two users work side by side (the session is a cookie). */
export async function userPage(browser: Browser, baseURL: string | undefined, session: Parameters<typeof signIn>[1]) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page, session);
  return page;
}

/** Types the paper slip's number into the slip header's No. box. */
export async function fillPaperNo(page: Page, no: string) {
  await page.locator('input[name="paperNo"]').fill(no);
}

/** Name or kind of the focused element, for keyboard-flow checks. */
export function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    return el.getAttribute("name") || el.dataset.kind || (el.hasAttribute("data-save") ? "save" : el.tagName.toLowerCase());
  });
}
