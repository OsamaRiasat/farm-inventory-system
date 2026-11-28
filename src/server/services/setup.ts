// Reference data (farms, items, suppliers, users) and A8 / A9 setup changes.
// Nothing is deleted: farms, sheds and items are deactivated (only duplicate items were merged once, client #28). Every change is in the audit log.

import { ApiError } from "@/lib/api/errors";
import { createItemSearch } from "@/lib/item-search";
import type { ItemRequestInput } from "@/lib/api/types";
import { nowStamp } from "@/lib/dates";
import { UNITS, type Farm, type Item, type ItemRequest } from "@/types/domain";
import { db, type Tx } from "../db";
import { farmInclude, toFarm, toItem, toItemRequest, toUser } from "../mappers";
import { passwordSchema, userSchema, type UserInput } from "@/features/admin/user-schema";
import { hashPassword } from "../password";
import { audit, getFarm, inTx, parse } from "../repo";

export type FarmPatch = { id: string; name: string; type: Farm["type"]; active: boolean; by: string };
export type ItemInput = Omit<Item, "id" | "number"> & { id?: string; by: string };

export async function listFarms(): Promise<Farm[]> {
  return (await db().farm.findMany({ include: farmInclude, orderBy: { seq: "asc" } })).map(toFarm);
}

export async function listItems(): Promise<Item[]> {
  return (await db().item.findMany({ orderBy: { number: "asc" } })).map(toItem);
}

export async function listSuppliers() {
  return (await db().supplier.findMany()).map((s) => s.name).sort();
}

export async function listUsers() {
  return (await db().user.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }] })).map(toUser);
}

// Item search: the Fuse index over all items, rebuilt when items change (or after a minute, for other servers' edits).
let search: { at: number; run: ReturnType<typeof createItemSearch> } | null = null;
export async function searchItems(q: string) {
  if (!search || Date.now() - search.at > 60_000) search = { at: Date.now(), run: createItemSearch(await listItems()) };
  return search.run(q, 20);
}

export function updateFarm(input: FarmPatch): Promise<Farm> {
  return inTx(async (tx) => {
    const farm = await getFarm(tx, input.id);
    if (!input.name.trim()) throw new ApiError("err.required");
    const old = `${farm.name} · ${farm.type} · ${farm.active ? "active" : "inactive"}`;
    const next = { ...farm, name: input.name.trim(), type: input.type, active: input.active };
    await tx.farm.update({ where: { id: farm.id }, data: { name: next.name, type: next.type, active: next.active } });
    await audit(tx, {
      user: input.by, farmId: farm.id, action: "setup", recordId: farm.id, recordNo: farm.code,
      old, new: `${next.name} · ${next.type} · ${next.active ? "active" : "inactive"}`,
    });
    return next;
  });
}

export function addShed(input: { farmId: string; name: string; by: string }) {
  return inTx(async (tx) => {
    const farm = await getFarm(tx, input.farmId);
    const name = input.name.trim();
    if (!name) throw new ApiError("err.required");
    if (farm.sheds.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new ApiError("err.duplicateName");
    const shed = { id: `${farm.id}-s${crypto.randomUUID().slice(0, 8)}`, farmId: farm.id, name, active: true };
    await tx.shed.create({ data: shed });
    await audit(tx, { user: input.by, farmId: farm.id, action: "setup", recordId: shed.id, recordNo: `${farm.code} ${name}`, new: name });
    return shed;
  });
}

export function updateShed(input: { id: string; name: string; active: boolean; by: string }) {
  return inTx(async (tx) => {
    const row = await tx.shed.findUnique({ where: { id: input.id } });
    if (!row) throw new ApiError("err.notFound");
    const farm = await getFarm(tx, row.farmId);
    const name = input.name.trim();
    if (!name) throw new ApiError("err.required");
    if (farm.sheds.some((s) => s.id !== row.id && s.name.toLowerCase() === name.toLowerCase())) throw new ApiError("err.duplicateName");
    const old = `${row.name}${row.active ? "" : " (inactive)"}`;
    const shed = { id: row.id, farmId: row.farmId, name, active: input.active };
    await tx.shed.update({ where: { id: row.id }, data: { name, active: input.active } });
    await audit(tx, {
      user: input.by, farmId: farm.id, action: "setup", recordId: shed.id, recordNo: `${farm.code} ${name}`,
      old, new: `${shed.name}${shed.active ? "" : " (inactive)"}`,
    });
    return shed;
  });
}

/** Adds an item (id omitted) or edits one. The unit can't change once the item has stock movements. */
export async function saveItem(input: ItemInput): Promise<Item> {
  const item = await inTx((tx) => writeItem(tx, input)).catch(duplicateNameError);
  search = null;
  return item;
}

/** Two saves of the same name at once: the unique name index (migration 20261128000000_dedupe_items) refuses the second. */
function duplicateNameError(e: unknown): never {
  if ((e as { code?: string })?.code === "P2002") throw new ApiError("err.duplicateName");
  throw e;
}

async function writeItem(tx: Tx, input: ItemInput): Promise<Item> {
  const name = input.name.trim();
  if (!name || !input.nameUr.trim() || !input.category.trim()) throw new ApiError("err.required");
  const dup = await tx.item.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { id: true },
  });
  if (dup) throw new ApiError("err.duplicateName");
  const fields = {
    name,
    nameUr: input.nameUr.trim(),
    aliases: input.aliases.map((a) => a.trim()).filter(Boolean),
    category: input.category.trim(),
    unit: input.unit,
    isFeed: input.isFeed,
    active: input.active,
  };
  if (input.id) {
    const row = await tx.item.findUnique({ where: { id: input.id } });
    if (!row) throw new ApiError("err.notFound");
    if (row.unit !== fields.unit && (await tx.movement.count({ where: { itemId: row.id }, take: 1 }))) throw new ApiError("err.unitLocked");
    const old = `${row.name} · ${row.unit} · ${row.category}${row.active ? "" : " (inactive)"}`;
    const saved = await tx.item.update({ where: { id: row.id }, data: fields });
    await audit(tx, {
      user: input.by, action: "setup", recordId: saved.id, recordNo: saved.name,
      old, new: `${saved.name} · ${saved.unit} · ${saved.category}${saved.active ? "" : " (inactive)"}`,
    });
    return toItem(saved);
  }
  const max = await tx.item.aggregate({ _max: { number: true } });
  const saved = await tx.item.create({
    data: { id: `item-${crypto.randomUUID().slice(0, 8)}`, number: (max._max.number ?? 0) + 1, ...fields },
  });
  await audit(tx, { user: input.by, action: "setup", recordId: saved.id, recordNo: saved.name, new: `${saved.name} · ${saved.unit} · ${saved.category}` });
  return toItem(saved);
}

// ── item requests (client #30) ──
// A farm asks for an item that isn't in the list. It is not an Item (not in search, not on slips) until the
// Admin approves it; approving creates the Item with the Admin's final name / Urdu name / category / unit.

export async function requestItem(input: ItemRequestInput & { farmId: string; requestedBy: string }): Promise<ItemRequest> {
  return inTx(async (tx) => {
    const name = input.name.trim();
    if (!name || !input.category.trim()) throw new ApiError("err.required");
    if (!UNITS.includes(input.unit)) throw new ApiError("err.required");
    if (await tx.item.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } })) {
      throw new ApiError("err.itemExists");
    }
    const waiting = await tx.itemRequest.findFirst({
      where: { farmId: input.farmId, status: "pending", name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (waiting) throw new ApiError("err.alreadyRequested");
    const row = await tx.itemRequest.create({
      data: {
        id: `ir-${crypto.randomUUID()}`,
        farmId: input.farmId,
        name,
        nameUr: input.nameUr.trim(),
        category: input.category.trim(),
        unit: input.unit,
        requestedBy: input.requestedBy,
        at: nowStamp(),
      },
    });
    await audit(tx, { user: input.requestedBy, farmId: input.farmId, action: "request_item", recordId: row.id, recordNo: name, new: `${name} · ${row.unit} · ${row.category}` });
    return toItemRequest(row);
  });
}

export async function listItemRequests(f: { farmId?: string; status?: ItemRequest["status"] } = {}): Promise<ItemRequest[]> {
  const rows = await db().itemRequest.findMany({
    where: { ...(f.farmId ? { farmId: f.farmId } : {}), ...(f.status ? { status: f.status } : {}) },
    orderBy: { at: "desc" },
  });
  return rows.map(toItemRequest);
}

/** Creates the item (the Admin may change any field first) and closes the request, in one transaction. */
export async function approveItemRequest(input: { requestId: string; item: Omit<ItemInput, "id" | "by">; by: string }): Promise<Item> {
  const item = await inTx(async (tx) => {
    const request = await tx.itemRequest.findUnique({ where: { id: input.requestId } });
    if (!request || request.status !== "pending") throw new ApiError("err.notFound");
    const created = await writeItem(tx, { ...input.item, by: input.by });
    await tx.itemRequest.update({ where: { id: request.id }, data: { status: "approved", itemId: created.id } });
    await audit(tx, { user: input.by, farmId: request.farmId, action: "approve_item", recordId: request.id, recordNo: created.name });
    return created;
  }).catch(duplicateNameError);
  search = null;
  return item;
}

export function rejectItemRequest(input: { requestId: string; note: string; by: string }): Promise<ItemRequest> {
  return inTx(async (tx) => {
    const request = await tx.itemRequest.findUnique({ where: { id: input.requestId } });
    if (!request || request.status !== "pending") throw new ApiError("err.notFound");
    if (!input.note.trim()) throw new ApiError("err.enterReason");
    const row = await tx.itemRequest.update({ where: { id: request.id }, data: { status: "rejected", note: input.note.trim() } });
    await audit(tx, { user: input.by, farmId: request.farmId, action: "reject_item", recordId: request.id, recordNo: request.name, reason: row.note ?? "" });
    return toItemRequest(row);
  });
}

// ── users (A10) ──
// The Admin adds and edits logins and sets new passwords. Never returns or audits a password (hash included).

/** Who is making the change: their name for the audit, their id for the "not yourself" guard. */
type Actor = { by: string; byUserId: string };

const userSummary = (u: { name: string; username: string; role: string; farmId: string | null; active: boolean }) =>
  `${u.name} · ${u.username} · ${u.role}${u.farmId ? ` ${u.farmId}` : ""}${u.active ? "" : " (inactive)"}`;

/** Adds a user (no id) or edits one. Deactivating signs the user out everywhere. */
export function saveUser(input: UserInput & Actor) {
  const v = parse(userSchema, input);
  return inTx(async (tx) => {
    const taken = await tx.user.findFirst({ where: { username: v.username, ...(v.id ? { NOT: { id: v.id } } : {}) }, select: { id: true } });
    if (taken) throw new ApiError("err.usernameTaken", undefined, [{ path: ["username"], id: "err.usernameTaken" }]);
    if (v.farmId) await getFarm(tx, v.farmId);
    const fields = { name: v.name, username: v.username, phone: v.phone, role: v.role, farmId: v.farmId ?? null, active: v.active };

    if (!v.id) {
      const saved = await tx.user.create({
        data: { id: `u-${crypto.randomUUID().slice(0, 8)}`, ...fields, passwordHash: await hashPassword(v.password!) },
      });
      await audit(tx, { user: input.by, farmId: saved.farmId ?? undefined, action: "add_user", recordId: saved.id, recordNo: saved.username, new: userSummary(saved) });
      return toUser(saved);
    }

    const row = await tx.user.findUnique({ where: { id: v.id } });
    if (!row) throw new ApiError("err.notFound");
    const losesAdmin = row.role === "admin" && row.active && (fields.role !== "admin" || !fields.active);
    if (losesAdmin && row.id === input.byUserId) throw new ApiError("err.notYourself");
    if (losesAdmin && !(await tx.user.count({ where: { role: "admin", active: true, NOT: { id: row.id } } }))) throw new ApiError("err.lastAdmin");
    const saved = await tx.user.update({ where: { id: row.id }, data: fields });
    if (row.active && !saved.active) await tx.session.deleteMany({ where: { userId: row.id } });
    await audit(tx, {
      user: input.by, farmId: saved.farmId ?? row.farmId ?? undefined, action: "edit_user", recordId: saved.id, recordNo: saved.username,
      old: userSummary(row), new: userSummary(saved),
    });
    return toUser(saved);
  });
}

/** Sets a new password and signs the user out everywhere (except the Admin's own current session). */
export function setUserPassword(input: { id: string; password: string; by: string; keepSessionId?: string }) {
  const { password } = parse(passwordSchema, input);
  return inTx(async (tx) => {
    const row = await tx.user.findUnique({ where: { id: input.id } });
    if (!row) throw new ApiError("err.notFound");
    await tx.user.update({ where: { id: row.id }, data: { passwordHash: await hashPassword(password) } });
    await tx.session.deleteMany({ where: { userId: row.id, ...(input.keepSessionId ? { NOT: { id: input.keepSessionId } } : {}) } });
    await audit(tx, { user: input.by, farmId: row.farmId ?? undefined, action: "set_password", recordId: row.id, recordNo: row.username });
    return toUser(row);
  });
}
