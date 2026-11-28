// A10 users (T05): the Admin adds and edits logins and sets new passwords. Rules over HTTP and on the service,
// then the screen by keyboard. Serial: the last-Admin check counts every active Admin, and only this file adds Admins.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/server/db";
import { saveUser } from "@/server/services/setup";
import { testFarm, unique } from "./db";
import { DEMO_PASSWORD, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const NEW_PASSWORD = "new-pass-42";

async function login(request: APIRequestContext, username: string, password = DEMO_PASSWORD) {
  return request.post("/api/auth/login", { data: { username, password } });
}

async function errorOf(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError) return e.id;
    throw e;
  }
  return null;
}

test("the Admin adds a Farm User who can then sign in; duplicate username and bad input refused", async ({ request, playwright, baseURL }) => {
  const farmId = await testFarm();
  const username = unique("u");
  expect((await login(request, "admin")).ok()).toBe(true);

  const res = await request.post("/api/users", {
    data: { name: "Test Keeper", username: `  ${username.toUpperCase()} `, phone: "0300", role: "farm", farmId, active: true, password: DEMO_PASSWORD },
  });
  expect(res.ok()).toBe(true);
  const user = await res.json();
  expect(user).toMatchObject({ name: "Test Keeper", username, role: "farm", farmId, active: true });
  expect(user.passwordHash).toBeUndefined();
  expect(user.password).toBeUndefined();

  const dup = await request.post("/api/users", { data: { name: "X", username, role: "farm", farmId, active: true, password: DEMO_PASSWORD } });
  expect((await dup.json()).error.id).toBe("err.usernameTaken");
  const bad = async (data: object) => (await (await request.post("/api/users", { data })).json()).error.id;
  expect(await bad({ name: "X", username: "has space", role: "admin", active: true, password: DEMO_PASSWORD })).toBe("err.usernameChars");
  expect(await bad({ name: "X", username: unique("u"), role: "farm", active: true, password: DEMO_PASSWORD })).toBe("err.pickFarm");
  expect(await bad({ name: "X", username: unique("u"), role: "admin", active: true, password: "short" })).toBe("err.passwordShort");

  const farm = await playwright.request.newContext({ baseURL });
  expect((await login(farm, username)).ok()).toBe(true);
  expect(await (await farm.get("/api/me")).json()).toEqual({ role: "farm", farmId, userName: "Test Keeper" });
  // A Farm User can't list or change users.
  expect((await farm.get("/api/users")).status()).toBe(404);
  expect((await farm.post("/api/users", { data: { name: "X", username: unique("u"), role: "admin", active: true, password: DEMO_PASSWORD } })).status()).toBe(404);
  expect((await farm.post(`/api/users/${user.id}/password`, { data: { password: NEW_PASSWORD } })).status()).toBe(404);

  const audit = await db().auditEntry.findFirst({ where: { action: "add_user", recordId: user.id } });
  expect(audit).toMatchObject({ user: "Accounts Admin", recordNo: username });
  expect(`${audit?.old} ${audit?.new}`).not.toContain(DEMO_PASSWORD);
  await farm.dispose();
});

test("a new password signs the user out everywhere; the old password stops working", async ({ request, playwright, baseURL }) => {
  const farmId = await testFarm();
  const username = unique("u");
  await login(request, "admin");
  const user = await (await request.post("/api/users", { data: { name: "Keeper", username, role: "farm", farmId, active: true, password: DEMO_PASSWORD } })).json();

  const farm = await playwright.request.newContext({ baseURL });
  await login(farm, username);
  expect((await farm.get("/api/farms")).ok()).toBe(true);

  const short = await request.post(`/api/users/${user.id}/password`, { data: { password: "1234567" } });
  expect((await short.json()).error.id).toBe("err.passwordShort");
  expect((await request.post(`/api/users/${user.id}/password`, { data: { password: NEW_PASSWORD } })).ok()).toBe(true);

  expect((await farm.get("/api/farms")).status()).toBe(401);
  expect((await login(farm, username)).ok()).toBe(false);
  expect((await login(farm, username, NEW_PASSWORD)).ok()).toBe(true);
  // Editing details never touches the password.
  const edited = await request.post(`/api/users/${user.id}`, { data: { ...user, name: "Keeper 2", password: "ignored-123" } });
  expect((await edited.json()).name).toBe("Keeper 2");
  expect((await login(farm, username, NEW_PASSWORD)).ok()).toBe(true);
  expect(await db().auditEntry.count({ where: { action: "set_password", recordId: user.id } })).toBe(1);
  await farm.dispose();
});

test("a deactivated user is signed out and can't sign in", async ({ request, playwright, baseURL }) => {
  const farmId = await testFarm();
  const username = unique("u");
  await login(request, "admin");
  const user = await (await request.post("/api/users", { data: { name: "Keeper", username, role: "farm", farmId, active: true, password: DEMO_PASSWORD } })).json();
  const farm = await playwright.request.newContext({ baseURL });
  await login(farm, username);

  expect((await request.post(`/api/users/${user.id}`, { data: { ...user, active: false } })).ok()).toBe(true);
  expect(await db().session.count({ where: { userId: user.id } })).toBe(0);
  expect((await farm.get("/api/farms")).status()).toBe(401);
  expect((await login(farm, username)).ok()).toBe(false);
  await farm.dispose();
});

test("the Admin can't deactivate or demote themselves, and the last active Admin stays", async () => {
  const seedAdmin = await db().user.findUniqueOrThrow({ where: { username: "admin" } });
  const asInput = (u: typeof seedAdmin) => ({ id: u.id, name: u.name, username: u.username, phone: u.phone, role: u.role, farmId: u.farmId ?? undefined, active: u.active });

  expect(await errorOf(() => saveUser({ ...asInput(seedAdmin), active: false, by: "Accounts Admin", byUserId: seedAdmin.id }))).toBe("err.notYourself");
  expect(
    await errorOf(() => saveUser({ ...asInput(seedAdmin), role: "farm", farmId: "aw02", by: "Accounts Admin", byUserId: seedAdmin.id })),
  ).toBe("err.notYourself");

  // A second Admin can be added and removed again while the first one stays…
  const second = await saveUser({ name: "Second Admin", username: unique("a"), phone: "", role: "admin", active: true, password: DEMO_PASSWORD, by: "Accounts Admin", byUserId: seedAdmin.id });
  await saveUser({ ...second, active: false, by: "Accounts Admin", byUserId: seedAdmin.id });
  // …but nobody can switch off the last active one.
  expect(await errorOf(() => saveUser({ ...asInput(seedAdmin), active: false, by: "Second Admin", byUserId: second.id }))).toBe("err.lastAdmin");
  expect((await db().user.findUniqueOrThrow({ where: { id: seedAdmin.id } })).active).toBe(true);
});

test("A10 by keyboard: Add user, Enter through the fields, Ctrl+S saves; the row opens the edit sheet", async ({ page }) => {
  const username = unique("k");
  await signIn(page, { role: "admin" });
  await page.goto("/admin/setup/users");
  await expect(page.locator("tbody tr:visible").first()).toBeVisible();

  await page.getByRole("button", { name: /Add user/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator('input[name="name"]')).toBeFocused();
  await page.keyboard.type("Keyboard Keeper");
  await page.keyboard.press("Enter");
  await expect(sheet.locator('input[name="username"]')).toBeFocused();
  await page.keyboard.type(username);
  await page.keyboard.press("Enter");
  await page.keyboard.type("03001234567");
  await page.keyboard.press("Enter");
  await expect(sheet.locator('select[name="role"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(sheet.locator('select[name="farmId"]')).toBeFocused();
  await sheet.locator('select[name="farmId"]').selectOption("aw05");
  await page.keyboard.press("Enter");
  await page.keyboard.type(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(sheet.locator('input[name="confirm"]')).toBeFocused();
  await page.keyboard.type("different");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(sheet.getByRole("alert")).toContainText("Passwords don't match");
  await sheet.locator('input[name="confirm"]').fill(DEMO_PASSWORD);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(sheet).toBeHidden();

  const row = page.locator("tbody tr:visible", { hasText: username });
  await expect(row).toContainText("Keyboard Keeper");
  await row.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: /Edit user/ })).toBeVisible();
  await expect(page.getByRole("dialog").locator('input[name="username"]')).toHaveValue(username);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  // Clean up: the farm user isn't needed by other tests.
  await db().user.update({ where: { username }, data: { active: false } });
});
