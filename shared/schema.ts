import { pgTable, text, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const animations = pgTable("animations", {
  id: serial("id").primaryKey(),
  originalSvg: text("original_svg").notNull(),
  description: text("description").notNull(),
  selectedElements: text("selected_elements").array(),
  animatedSvg: text("animated_svg"),
  error: text("error"),
});

export const insertAnimationSchema = createInsertSchema(animations).pick({
  originalSvg: true,
  description: true,
}).extend({
  selectedElements: z.array(z.string()).optional(),
});

export type InsertAnimation = z.infer<typeof insertAnimationSchema>;
export type Animation = typeof animations.$inferSelect;