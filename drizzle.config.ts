// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema:    "./plugins/src/db/schema/index.ts",
  out:       "./plugins/src/db/migrations",
  dialect:   "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;