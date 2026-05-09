import {
  pgTable,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  decimal,
  real,
  index,
  bigserial,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";

// ============================================================================
// Interaction Ledger (from wp_mp_rp_interactions)
//
// Every meaningful user action (like, comment, share, read, vote, etc.) is
// logged here with a weight and reward value. This table will grow very fast,
// so we use bigserial with mode: "bigint" to avoid the JS Number.MAX_SAFE_INTEGER
// precision wall at ~9 quadrillion.
//
// IMPORTANT: BigInt is not JSON-serializable by default. In your Hono
// response layer, either:
//   - Use a custom replacer: JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v)
//   - Or coerce to string before sending: { ...row, id: row.id.toString() }
// ============================================================================

export const interactions = pgTable(
  "interactions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: varchar("module", { length: 50 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    targetId: integer("target_id").notNull(),
    targetType: varchar("target_type", { length: 50 }).default("post"),
    interactionWeight: decimal("interaction_weight", {
      precision: 16,
      scale: 8,
    }).notNull(),
    value: decimal("value", { precision: 16, scale: 8 }).notNull(),
    interactorReward: decimal("interactor_reward", {
      precision: 16,
      scale: 8,
    }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("interactions_user_id_idx").on(table.userId),
    moduleTypeIdx: index("interactions_module_type_idx").on(table.module, table.type),
    targetIdx: index("interactions_target_idx").on(table.targetId, table.targetType),
    createdAtIdx: index("interactions_created_at_idx").on(table.createdAt),
  }),
);

export const readingSessions = pgTable(
  "reading_sessions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull(),
    totalTimeToReadSec: real("total_time_to_read_sec").notNull(),
    userSpentTimeSec: real("user_spent_time_sec").notNull(),
    completionRatio: real("completion_ratio").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index("reading_sessions_post_id_idx").on(table.postId),
    userIdIdx: index("reading_sessions_user_id_idx").on(table.userId),
  }),
);
