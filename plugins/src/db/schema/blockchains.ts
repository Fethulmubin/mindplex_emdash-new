import { pgTable, serial, varchar, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userWallets = pgTable(
  "user_wallets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicAddress: varchar("public_address", { length: 100 }).unique(),
    isVerified: boolean("is_verified").default(false).notNull(),
    paymentAddress: varchar("payment_address", { length: 100 }),
    isPaymentVerified: boolean("is_payment_verified").default(false).notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("user_wallets_user_id_idx").on(table.userId),
    publicAddressIdx: index("user_wallets_public_address_idx").on(table.publicAddress),
  }),
);
