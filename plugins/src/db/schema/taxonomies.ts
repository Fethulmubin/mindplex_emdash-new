import { pgTable, serial, varchar, text, boolean, timestamp, integer, unique, index } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import type { TaxonomyType } from "./types";

export const taxonomies = pgTable(
  "taxonomies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).unique().notNull(),
    type: varchar("type", { length: 32 }).$type<TaxonomyType>().notNull(),
    description: text("description"),
    parentId: integer("parent_id").references((): any => taxonomies.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("taxonomies_type_idx").on(table.type),
    slugIdx: index("taxonomies_slug_idx").on(table.slug),
    parentIdIdx: index("taxonomies_parent_id_idx").on(table.parentId),
  }),
);

export const postTaxonomies = pgTable(
  "post_taxonomies",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    taxonomyId: integer("taxonomy_id")
      .notNull()
      .references(() => taxonomies.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").default(false),
  },
  (table) => ({
    postTaxonomiesPk: unique("post_taxonomies_pk").on(table.postId, table.taxonomyId),
    taxonomyIdIdx: index("post_taxonomies_taxonomy_id_idx").on(table.taxonomyId),
  }),
);
