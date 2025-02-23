import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Animation parameters schema
export const animationParamsSchema = z.object({
  duration: z.number().min(0.1).max(10).default(1),
  easing: z.enum(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']).default('ease'),
  repeat: z.number().int().min(0).max(Infinity).default(0),
  direction: z.enum(['normal', 'reverse', 'alternate']).default('normal'),
});

export type AnimationParams = z.infer<typeof animationParamsSchema>;

// Message in the animation conversation
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

// Main animations table
export const animations = pgTable("animations", {
  id: serial("id").primaryKey(),
  originalSvg: text("original_svg").notNull(),
  description: text("description").notNull(),
  selectedElements: text("selected_elements").array(),
  animatedSvg: text("animated_svg"),
  parameters: jsonb("parameters").$type<AnimationParams>(),
  conversation: jsonb("conversation").$type<Message[]>(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for creating a new animation
export const insertAnimationSchema = createInsertSchema(animations).pick({
  originalSvg: true,
  description: true,
}).extend({
  selectedElements: z.array(z.string()).optional(),
  parameters: animationParamsSchema.optional(),
});

export type InsertAnimation = z.infer<typeof insertAnimationSchema>;
export type Animation = typeof animations.$inferSelect;