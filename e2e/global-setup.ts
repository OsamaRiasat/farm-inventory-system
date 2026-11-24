// Before every run: empty the test database and load the demo history (same as `npm run db:reset`).
import { execSync } from "node:child_process";

export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL!, NODE_OPTIONS: "" };
  execSync("npx prisma migrate reset --force", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts --demo", { env, stdio: "pipe" });
}
