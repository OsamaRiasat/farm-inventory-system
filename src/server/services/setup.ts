// Reference data (farms, items, suppliers, users) and A8 / A9 setup changes.
// Nothing is deleted: farms, sheds and items are deactivated. Every change is in the audit log.

import { ApiError } from "@/lib/api/errors";
import { createItemSearch } from "@/lib/item-search";
import type { Farm, Item } from "@/types/domain";
import { db } from "../db";
import { farmInclude, toFarm, toItem, toUser } from "../mappers";
import { audit, getFarm, inTx } from "../repo";

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
  const item = await inTx(async (tx) => {
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
  });
  search = null;
  return item;
}
