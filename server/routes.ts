import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertAnimationSchema } from "@shared/schema";
import { generateSvgAnimation } from "./openai";
import animationsRouter from "./routes/animations";
import svgRouter from "./routes/svg";

export async function registerRoutes(app: Express) {
  // Mount routers
  app.use("/api/animations", animationsRouter);
  app.use("/api/svg", svgRouter);

  return createServer(app);
}