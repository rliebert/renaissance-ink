import { Router } from 'express';
import { z } from 'zod';
import { JSDOM } from 'jsdom';
import { extractSelectedElements } from '../utils/svg';

const router = Router();

const previewRequestSchema = z.object({
  svgContent: z.string(),
  selectedElements: z.array(z.string())
});

function calculateBoundingBox(elements: Element[]): { 
  minX: number, 
  minY: number, 
  maxX: number, 
  maxY: number 
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  elements.forEach(element => {
    // Get all numeric values from attributes
    const attributes = element.attributes;
    for (let i = 0; i < attributes.length; i++) {
      const value = attributes[i].value;
      const numbers = value.match(/-?\d+\.?\d*/g);
      if (numbers) {
        numbers.forEach((num, index) => {
          const n = parseFloat(num);
          if (!isNaN(n)) {
            // Even indices are X coordinates, odd indices are Y coordinates
            if (index % 2 === 0) {
              minX = Math.min(minX, n);
              maxX = Math.max(maxX, n);
            } else {
              minY = Math.min(minY, n);
              maxY = Math.max(maxY, n);
            }
          }
        });
      }
    }

    // Handle path data specially
    if (element.tagName.toLowerCase() === 'path' && element.getAttribute('d')) {
      const pathData = element.getAttribute('d') || '';
      const numbers = pathData.match(/-?\d+\.?\d*/g);
      if (numbers) {
        numbers.forEach((num, index) => {
          const n = parseFloat(num);
          if (!isNaN(n)) {
            // Even indices are X coordinates, odd indices are Y coordinates
            if (index % 2 === 0) {
              minX = Math.min(minX, n);
              maxX = Math.max(maxX, n);
            } else {
              minY = Math.min(minY, n);
              maxY = Math.max(maxY, n);
            }
          }
        });
      }
    }
  });

  // If no bounds were found, use defaults
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 250, maxY: 250 };
  }

  return { minX, minY, maxX, maxY };
}

// Generate preview of selected elements
router.post('/preview', async (req, res) => {
  try {
    const { svgContent, selectedElements } = previewRequestSchema.parse(req.body);

    const dom = new JSDOM(svgContent);
    const document = dom.window.document;

    // Find selected elements
    const elements = selectedElements
      .map(id => document.getElementById(id))
      .filter((el): el is Element => el !== null);

    if (elements.length === 0) {
      throw new Error("No selected elements found");
    }

    // Calculate original bounding box
    const bounds = calculateBoundingBox(elements);

    // Calculate dimensions
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Add padding (10% of the largest dimension)
    const padding = Math.max(width, height) * 0.1;
    const viewBoxSize = Math.max(width, height) + padding * 2;

    // Create new SVG with translated elements
    const previewSvg = document.createElement('svg');
    previewSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    previewSvg.setAttribute('viewBox', `0 0 ${viewBoxSize} ${viewBoxSize}`);
    previewSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Create a group to translate all elements
    const group = document.createElement('g');
    const translateX = -bounds.minX + padding;
    const translateY = -bounds.minY + padding;
    group.setAttribute('transform', `translate(${translateX} ${translateY})`);

    // Copy selected elements into the group
    elements.forEach(element => {
      group.appendChild(element.cloneNode(true));
    });

    previewSvg.appendChild(group);

    res.json({ preview: previewSvg.outerHTML });
  } catch (error) {
    console.error('Error generating SVG preview:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: errorMessage });
  }
});

export default router;