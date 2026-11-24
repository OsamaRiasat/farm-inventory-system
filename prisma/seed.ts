// `npm run db:seed` — base data (farms, items, logins); add `-- --demo` for two weeks of demo history.
// Base logins get random passwords, printed once. Demo logins all use DEMO_PASSWORD (default "demo1234").
// SEED_NOW="2026-10-27T12:00:00+05:00" fixes the demo's "today" (tests).

import "dotenv/config";
import { db } from "@/server/db";
import { seedBase } from "@/server/seed/base";
import { seedDemo } from "@/server/seed/demo";

async function main() {
  const demo = process.argv.includes("--demo") || process.env.SEED_DEMO === "1";
  const started = Date.now();
  const logins = await seedBase({ password: demo ? (process.env.DEMO_PASSWORD ?? "demo1234") : undefined });
  if (demo) await seedDemo(process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date());
  console.log(`Seeded ${demo ? "base + demo history" : "base data"} in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  console.log(demo ? `Logins: admin, aw01 … layer04 — password ${logins[0].password}` : "Logins (shown once):");
  if (!demo) for (const l of logins) console.log(`  ${l.username.padEnd(12)} ${l.password}  (${l.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
