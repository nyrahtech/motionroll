import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  motionrollPool?: Pool;
};

const pool =
  globalForDb.motionrollPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.motionrollPool = pool;
}

export const db = drizzle(pool, { schema });
