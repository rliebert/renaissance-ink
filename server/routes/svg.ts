import { Router } from 'express';
import { z } from 'zod';
import { extractSelectedElements } from '../utils/svg';

const router = Router();

const previewRequestSchema = z.object({
  svgContent: z.string(),
  selectedElements: z.array(z.string())
});

// Generate preview of selected elements
router.post('/preview', async (req, res) => {
  try {
    const { svgContent, selectedElements } = previewRequestSchema.parse(req.body);
    const previewSvg = extractSelectedElements(svgContent, selectedElements);
    res.json({ preview: previewSvg });
  } catch (error) {
    console.error('Error generating SVG preview:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: errorMessage });
  }
});

export default router;
