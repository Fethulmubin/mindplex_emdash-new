import { pgTable, serial, varchar, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { EmailDeliveryStatus } from "./types";

// we will deprecate this for much simpler managed email service

export const mailingListSubscribers = pgTable(
  "mailing_list_subscribers",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    listType: varchar("list_type", { length: 50 }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).defaultNow().notNull(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index("mailing_subscribers_email_idx").on(table.email),
    listTypeIdx: index("mailing_subscribers_list_type_idx").on(table.listType),
  }),
);

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  message: text("message").notNull(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: serial("id").primaryKey(),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    templateName: varchar("template_name", { length: 255 }).notNull(),
    objectId: varchar("object_id", { length: 255 }),
    status: varchar("status", { length: 20 }).$type<EmailDeliveryStatus>().default("pending").notNull(),
    sentById: integer("sent_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("email_campaigns_status_idx").on(table.status)],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    externalMessageId: varchar("external_message_id", { length: 255 }),
    status: varchar("status", { length: 20 }).$type<EmailDeliveryStatus>().default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("email_deliveries_campaign_id_idx").on(table.campaignId),
    index("email_deliveries_status_idx").on(table.status),
  ],
);
