import { Router } from 'express';
import { z } from 'zod';
import { JSDOM } from 'jsdom';

const router = Router();

const previewRequestSchema = z.object({
  svgContent: z.string(),
  selectedElements: z.array(z.string())
});

function calculateElementBounds(element: Element): { 
  minX: number, 
  minY: number, 
  maxX: number, 
  maxY: number 
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'circle': {
      const cx = parseFloat(element.getAttribute('cx') || '0');
      const cy = parseFloat(element.getAttribute('cy') || '0');
      const r = parseFloat(element.getAttribute('r') || '0');
      minX = cx - r;
      maxX = cx + r;
      minY = cy - r;
      maxY = cy + r;
      break;
    }
    case 'rect': {
      const x = parseFloat(element.getAttribute('x') || '0');
      const y = parseFloat(element.getAttribute('y') || '0');
      const width = parseFloat(element.getAttribute('width') || '0');
      const height = parseFloat(element.getAttribute('height') || '0');
      minX = x;
      maxX = x + width;
      minY = y;
      maxY = y + height;
      break;
    }
    case 'path': {
      const d = element.getAttribute('d') || '';
      const numbers = d.match(/-?\d+\.?\d*/g);
      if (numbers) {
        numbers.forEach((num, index) => {
          const n = parseFloat(num);
          if (!isNaN(n)) {
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
      break;
    }
    default: {
      // For other elements, check all coordinate attributes
      ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy'].forEach(attr => {
        const value = parseFloat(element.getAttribute(attr) || '0');
        if (!isNaN(value)) {
          if (attr.includes('x')) {
            minX = Math.min(minX, value);
            maxX = Math.max(maxX, value);
          } else {
            minY = Math.min(minY, value);
            maxY = Math.max(maxY, value);
          }
        }
      });
    }
  }

  // If no bounds were found, use a default size
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return { minX, minY, maxX, maxY };
}

function calculateGroupBounds(elements: Element[]): { 
  minX: number, 
  minY: number, 
  maxX: number, 
  maxY: number 
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  elements.forEach(element => {
    const bounds = calculateElementBounds(element);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  });

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
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

    // Calculate bounds of all selected elements
    const bounds = calculateGroupBounds(elements);

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