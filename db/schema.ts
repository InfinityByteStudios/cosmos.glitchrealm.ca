import { pgTable, serial, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const presets = pgTable(
  "presets",
  {
    id: serial().primaryKey(),
    userId: text("user_id").notNull(),
    name: text().notNull(),
    settings: jsonb().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("presets_user_name_idx").on(t.userId, t.name)],
);
