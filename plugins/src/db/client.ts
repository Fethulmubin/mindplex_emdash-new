import { env } from "process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./schema/relations";
import * as schema from "./schema/index";

const ssl =
  (env.DB_USE_SSL === "true" || process.env.DB_USE_SSL === "true")
    ? {
        rejectUnauthorized: false,
      }
    : false;

const pool = new Pool({
  connectionString: env.DATABASE_URL || process.env.DATABASE_URL,
  ssl: ssl,
});
export const db = drizzle(pool);
export const pgPool = pool;
export type DbClient = typeof db;
export type PgPool = typeof pool;
