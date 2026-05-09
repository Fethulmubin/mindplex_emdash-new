import { pgTable, serial, varchar, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";

export const faqCategories = pgTable(
  "faq_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    parentId: integer("parent_id").references((): any => faqCategories.id, {
      onDelete: "cascade",
    }),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    parentIdIdx: index("faq_categories_parent_id_idx").on(table.parentId),
  }),
);

export const faqQuestions = pgTable(
  "faq_questions",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => faqCategories.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    displayOrder: integer("display_order").default(0),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    categoryIdIdx: index("faq_questions_category_id_idx").on(table.categoryId),
  }),
);
