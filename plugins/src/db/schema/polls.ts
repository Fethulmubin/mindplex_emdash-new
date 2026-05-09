import { pgTable, serial, varchar, text, jsonb, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";
import type { PollType, PollStyles } from "./types";

export const polls = pgTable(
  "polls",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    createdById: integer("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    question: text("question").notNull(),
    type: varchar("type", { length: 30 }).$type<PollType>().default("single_choice").notNull(),
    imageUrl: text("image_url"),
    styles: jsonb("styles").$type<PollStyles>(),
    isActive: boolean("is_active").default(true).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    postIdIdx: index("polls_post_id_idx").on(table.postId),
    isActiveIdx: index("polls_is_active_idx").on(table.isActive),
  }),
);

export const pollCategories = pgTable("poll_categories", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
});

export const pollOptions = pgTable(
  "poll_options",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    imageUrl: text("image_url"),
    displayOrder: integer("display_order").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pollIdIdx: index("poll_options_poll_id_idx").on(table.pollId),
  }),
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: integer("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    voterIp: varchar("voter_ip", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pollIdIdx: index("poll_votes_poll_id_idx").on(table.pollId),
    userIdIdx: index("poll_votes_user_id_idx").on(table.userId),
  }),
);
