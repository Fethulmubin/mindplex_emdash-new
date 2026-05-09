import { pgTable, serial, varchar, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { ReactionType, EmojiSentiment } from "./types";

export const contentSources = pgTable(
  "content_sources",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("content_sources_user_id_idx").on(table.userId),
  }),
);

export const contentSourceReactions = pgTable(
  "content_source_reactions",
  {
    id: serial("id").primaryKey(),
    sourceItemId: varchar("source_item_id", { length: 255 }).notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reaction: varchar("reaction", { length: 10 }).$type<ReactionType>(),
    emojiValue: varchar("emoji_value", { length: 20 }),
    emojiSentiment: varchar("emoji_sentiment", {
      length: 10,
    }).$type<EmojiSentiment>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sourceItemIdx: index("content_source_reactions_source_item_idx").on(table.sourceItemId),
    userIdIdx: index("content_source_reactions_user_id_idx").on(table.userId),
  }),
);
