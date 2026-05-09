import { pgTable, serial, varchar, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userInterests = pgTable(
  "user_interests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    interest: varchar("interest", { length: 255 }).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_interests_user_id_idx").on(table.userId),
  }),
);

export const userEducation = pgTable(
  "user_educations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    educationalBackground: varchar("educational_background", {
      length: 255,
    }).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_educations_user_id_idx").on(table.userId),
  }),
);
