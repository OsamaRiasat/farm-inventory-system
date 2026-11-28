// Base data every database starts with: 11 farms with sheds, the client's 1,947 items, and one login per
// farm plus the Accounts Admin. No stock: opening balances are loaded from the client's counts.

import { randomBytes } from "node:crypto";
import type { FarmType, Unit } from "@/types/domain";
import { db } from "../db";
import { hashPassword } from "../password";
import farmsJson from "./farms.json";
import itemsJson from "./items.json";

export const ADMIN_NAME = "Accounts Admin";

export type SeededLogin = { username: string; name: string; password: string };

/** Farm User login = farm id ("aw02"); Admin = "admin". `password` fixed for demos, else random per user. */
export async function seedBase(opts: { password?: string } = {}): Promise<SeededLogin[]> {
  if (await db().farm.count()) throw new Error("The database already has farms. Reset it first (npm run db:reset).");

  for (const f of farmsJson) {
    await db().farm.create({
      data: {
        id: f.id,
        code: f.code,
        name: f.name,
        type: f.type as FarmType,
        sheds: { create: Array.from({ length: f.sheds }, (_, i) => ({ id: `${f.id}-s${i + 1}`, name: `Shed ${i + 1}` })) },
      },
    });
  }
  await db().item.createMany({ data: itemsJson.map((i) => ({ ...i, unit: i.unit as Unit })) });

  const logins: SeededLogin[] = [];
  const people = [
    ...farmsJson.map((f, i) => ({
      id: `u-${f.id}`, username: f.id, name: `${f.code} Store Keeper`, role: "farm" as const, farmId: f.id,
      phone: `0300-55500${String(i + 1).padStart(2, "0")}`,
    })),
    { id: "u-admin", username: "admin", name: ADMIN_NAME, role: "admin" as const, farmId: null, phone: "0300-5550000" },
  ];
  for (const p of people) {
    const password = opts.password ?? randomBytes(6).toString("base64url");
    await db().user.create({ data: { ...p, passwordHash: await hashPassword(password) } });
    logins.push({ username: p.username, name: p.name, password });
  }
  return logins;
}
