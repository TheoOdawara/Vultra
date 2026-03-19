import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").notNull().default(sql`gen_uuid_v7()`).primaryKey(),

  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),

  plan: text("plan", { enum: ["trial", "pro", "enterprise"] })
    .notNull()
    .default("trial"),

  settings: jsonb("settings").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
