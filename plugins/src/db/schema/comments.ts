import { pgTable, serial, varchar, text, timestamp, integer, unique, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";
import type { CommentStatus, CommentClass, Sentiment } from "./types";

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    guestAuthorName: varchar("guest_author_name", { length: 255 }),
    guestAuthorEmail: varchar("guest_author_email", { length: 255 }),
    parentId: integer("parent_id").references((): any => comments.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    status: varchar("status", { length: 20 }).$type<CommentStatus>().default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    postIdIdx: index("comments_post_id_idx").on(table.postId),
    authorIdIdx: index("comments_author_id_idx").on(table.authorId),
    parentIdIdx: index("comments_parent_id_idx").on(table.parentId),
    statusIdx: index("comments_status_idx").on(table.status),
    postStatusCreatedIdx: index("comments_post_status_created_idx").on(table.postId, table.status, table.createdAt),
  }),
);

export const commentClassifications = pgTable(
  "comment_classifications",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    classifiedById: integer("classified_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classification: varchar("classification", { length: 30 }).$type<CommentClass>().notNull(),
    sentiment: varchar("sentiment", { length: 30 }).$type<Sentiment>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCommentUnique: unique("comment_classifications_user_comment_idx").on(table.commentId, table.classifiedById),
    commentIdIdx: index("comment_classifications_comment_id_idx").on(table.commentId),
  }),
);
