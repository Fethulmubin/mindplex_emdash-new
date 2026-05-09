import { pgTable, varchar, text, timestamp, integer, index, bigserial } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { NotificationStatus } from "./types";

export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 50 }).notNull(),
    targetId: integer("target_id"),
    targetType: varchar("target_type", { length: 50 }),
    message: text("message"),
    status: varchar("status", { length: 20 }).$type<NotificationStatus>().default("unread").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    userStatusIdx: index("notifications_user_status_idx").on(table.userId, table.status),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);
