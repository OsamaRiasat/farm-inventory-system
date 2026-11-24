// The one PrismaClient per process (a connection pool). Server only: screens reach data through src/lib/api.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example).");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Created on first use, so importing this file during the build needs no database. */
export function db(): PrismaClient {
  return (globalForPrisma.prisma ??= create());
}

export type Tx = Prisma.TransactionClient;
