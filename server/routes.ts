import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertAnimationSchema } from "@shared/schema";
import { generateSvgAnimation } from "./openai";

export async function registerRoutes(app: Express) {
  app.post("/api/animations", async (req, res) => {
    try {
      const data = insertAnimationSchema.parse(req.body);

      // Validate SVG input
      if (!data.originalSvg.includes('<svg')) {
        return res.status(400).json({ message: 'Invalid SVG file' });
      }

      const animation = await storage.createAnimation(data);

      try {
        const animatedSvg = await generateSvgAnimation(
          data.originalSvg,
          data.description
        );
        const updated = await storage.updateAnimation(animation.id, animatedSvg);
        res.json(updated);
      } catch (error: any) {
        console.error("Animation generation error:", error);
        const updated = await storage.updateAnimationError(
          animation.id,
          error?.message || 'Failed to generate animation'
        );
        res.status(500).json(updated);
      }
    } catch (error: any) {
      console.error("Request processing error:", error);
      res.status(400).json({ message: error?.message || 'Invalid request' });
    }
  });

  app.get("/api/animations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const animation = await storage.getAnimation(id);

    if (!animation) {
      res.status(404).json({ message: "Animation not found" });
      return;
    }

    res.json(animation);
  });

  return createServer(app);
}