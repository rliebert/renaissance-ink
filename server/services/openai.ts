import OpenAI from "openai";
import { AnimationParams, Message } from "@shared/schema";
import { JSDOM } from "jsdom";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AnimationRequest {
  svgContent: string;
  selectedElements: string[];
  referenceElements?: string[];
  description: string;
  parameters?: Partial<AnimationParams>;
  conversation?: Message[];
}

interface AnimationResponse {
  animatedSvg: string;
  suggestedParams: AnimationParams;
  explanation: string;
}

interface AnimationElement {
  elementId: string;
  animations: string[];  // Array of SMIL animation elements to be added
}

function insertAnimations(svgContent: string, animationElements: AnimationElement[]): string {
  const dom = new JSDOM(svgContent);
  const document = dom.window.document;

  // Get or create defs element for storing animation definitions
  const svg = document.querySelector('svg');
  if (!svg) throw new Error("Invalid SVG: no svg element found");

  let defs = document.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  // Process each element's animations
  for (const { elementId, animations } of animationElements) {
    const element = document.getElementById(elementId);
    if (element) {
      // Add each animation to the element
      for (const animation of animations) {
        const template = document.createElement('template');
        template.innerHTML = animation.trim();
        element.appendChild(template.content.firstChild!);
      }
    }
  }

  return document.querySelector('svg')?.outerHTML || '';
}

// Helper function to get element details including coordinates, transforms, and center point
function getElementDetails(document: Document, id: string): string {
  const element = document.getElementById(id);
  if (!element) return id;

  const tag = element.tagName.toLowerCase();
  const bbox = element.getBBox?.() || {};
  const cx = bbox.x !== undefined ? bbox.x + bbox.width / 2 : element.getAttribute('cx');
  const cy = bbox.y !== undefined ? bbox.y + bbox.height / 2 : element.getAttribute('cy');
  const transform = element.getAttribute('transform') || '';
  const path = element.getAttribute('d');

  // Create detailed debug info
  let details = `#${id} (${tag}`;
  if (cx !== null && cy !== null) details += ` center=(${cx},${cy})`;
  if (transform) details += `, transform=${transform}`;
  if (path) details += `, path data available`;
  details += ')';

  return details;
}

export function extractSelectedElements(svgContent: string, elementIds: string[]): { svg: string; debug: string } {
  const dom = new JSDOM(svgContent);
  const document = dom.window.document;

  // Extract viewBox and other necessary attributes from original SVG
  const originalSvg = document.querySelector('svg');
  if (!originalSvg) throw new Error("Invalid SVG: no svg element found");

  // Create debug info with element center points
  const debug = {
    originalViewBox: originalSvg.getAttribute('viewBox'),
    originalWidth: originalSvg.getAttribute('width'),
    originalHeight: originalSvg.getAttribute('height'),
    selectedElements: elementIds.map(id => {
      const element = document.getElementById(id);
      const bbox = element?.getBBox?.() || {};
      return {
        id,
        tag: element?.tagName.toLowerCase(),
        center: {
          x: bbox.x !== undefined ? bbox.x + bbox.width / 2 : element?.getAttribute('cx'),
          y: bbox.y !== undefined ? bbox.y + bbox.height / 2 : element?.getAttribute('cy'),
        },
        transform: element?.getAttribute('transform'),
        path: element?.getAttribute('d'),
      };
    }),
  };

  // Create a new minimal SVG with only selected elements
  const minimalSvg = document.createElement('svg');
  minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (debug.originalViewBox) minimalSvg.setAttribute('viewBox', debug.originalViewBox);
  if (debug.originalWidth) minimalSvg.setAttribute('width', debug.originalWidth);
  if (debug.originalHeight) minimalSvg.setAttribute('height', debug.originalHeight);

  // Copy selected elements with their coordinates and transforms preserved
  for (const id of elementIds) {
    const element = document.getElementById(id);
    if (element) {
      const clone = element.cloneNode(true) as Element;

      // Preserve original coordinates and transforms
      const transform = element.getAttribute('transform');
      if (transform) {
        clone.setAttribute('transform', transform);
      }

      // Get original element attributes that affect appearance
      const originalStyle = element.getAttribute('data-original-style') || element.getAttribute('style') || '';
      const originalFill = element.getAttribute('fill');
      const originalStroke = element.getAttribute('stroke');

      // Remove any highlighting styles we added
      clone.removeAttribute('style');

      // Combine original styles
      let combinedStyles = originalStyle;
      if (originalFill && !originalStyle.includes('fill:')) {
        combinedStyles += `; fill: ${originalFill}`;
      }
      if (originalStroke && !originalStyle.includes('stroke:')) {
        combinedStyles += `; stroke: ${originalStroke}`;
      }

      if (combinedStyles) {
        clone.setAttribute('style', combinedStyles.replace(/^;\s*/, ''));
      }

      minimalSvg.appendChild(clone);
    }
  }

  return {
    svg: minimalSvg.outerHTML,
    debug: JSON.stringify(debug, null, 2)
  };
}

export async function generateAnimation(request: AnimationRequest): Promise<AnimationResponse> {
  try {
    const dom = new JSDOM(request.svgContent);
    const document = dom.window.document;

    // Get detailed element information including center points
    const elementsToAnimate = request.selectedElements
      .map(id => getElementDetails(document, id))
      .join(', ');

    const referencePoints = request.referenceElements?.length 
      ? `\nReference points: ${request.referenceElements.map(id => getElementDetails(document, id)).join(', ')}`
      : '';

    // Get simplified SVG with debug info
    const { svg: simplifiedSvg, debug: debugInfo } = extractSelectedElements(request.svgContent, 
      [...request.selectedElements, ...(request.referenceElements || [])]);

    console.log('Animation Generation Debug:', {
      selectedElements: request.selectedElements,
      referenceElements: request.referenceElements,
      simplifiedSvgInfo: debugInfo,
      prompt: {
        elementsToAnimate,
        referencePoints,
        description: request.description
      }
    });

    // Include previous conversation context
    const conversationContext = request.conversation?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    const messages = [
      {
        role: "system",
        content: `You are an expert in SVG SMIL animations. Generate precise animations that maintain spatial relationships.

Requirements:
1. Return a JSON object containing animation elements
2. Use relative coordinates when animating with reference points
3. Keep transforms and coordinate systems consistent
4. When rotating elements around a reference point, use that point's center as the transform origin

Return format:
{
  "animations": [
    {
      "elementId": "path1",
      "animations": ["<animateTransform.../>"]
    }
  ],
  "parameters": {
    "duration": 2,
    "easing": "ease",
    "repeat": 0,
    "direction": "normal"
  },
  "explanation": "Brief description"
}`
      },
      ...conversationContext,
      {
        role: "user",
        content: `Create animations for these elements (${elementsToAnimate})${referencePoints}
Description: "${request.description}"

Reference points should be used as anchors for animations (e.g. as rotation centers) but should not be animated themselves.

${simplifiedSvg}`
      }
    ];

    console.log('OpenAI Request:', {
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    console.log('OpenAI Response:', {
      content,
      usage: response.usage,
      model: response.model
    });

    const result = JSON.parse(content);

    // Insert the animations into the original SVG
    const animatedSvg = insertAnimations(request.svgContent, result.animations);

    console.log('Generated Animated SVG:', {
      originalLength: request.svgContent.length,
      animatedLength: animatedSvg.length,
      addedAnimations: result.animations.map(a => ({ 
        elementId: a.elementId, 
        numAnimations: a.animations.length 
      }))
    });

    return {
      animatedSvg,
      suggestedParams: {
        duration: result.parameters?.duration || 1,
        easing: result.parameters?.easing || 'ease',
        repeat: result.parameters?.repeat || 0,
        direction: result.parameters?.direction || 'normal'
      },
      explanation: result.explanation
    };
  } catch (error: unknown) {
    console.error('Animation Generation Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate animation: ${errorMessage}`);
  }
}