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

export function extractSelectedElements(svgContent: string, elementIds: string[]): { svg: string; debug: string } {
  const dom = new JSDOM(svgContent);
  const document = dom.window.document;

  // Extract viewBox and other necessary attributes from original SVG
  const originalSvg = document.querySelector('svg');
  if (!originalSvg) throw new Error("Invalid SVG: no svg element found");

  // Create debug info
  const debug = {
    originalViewBox: originalSvg.getAttribute('viewBox'),
    originalWidth: originalSvg.getAttribute('width'),
    originalHeight: originalSvg.getAttribute('height'),
    elementIds,
  };

  // Create a new minimal SVG with only selected elements
  const minimalSvg = document.createElement('svg');
  minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (debug.originalViewBox) minimalSvg.setAttribute('viewBox', debug.originalViewBox);
  if (debug.originalWidth) minimalSvg.setAttribute('width', debug.originalWidth);
  if (debug.originalHeight) minimalSvg.setAttribute('height', debug.originalHeight);

  // Copy selected elements
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
    // Get simplified SVG with debug info
    const { svg: simplifiedSvg, debug: debugInfo } = extractSelectedElements(request.svgContent, 
      [...request.selectedElements, ...(request.referenceElements || [])]);

    // Include previous conversation context
    const conversationContext = request.conversation?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    const messages = [
      {
        role: "system",
        content: `You are an expert in SVG SMIL animations. Generate animations based on the following rules:

1. Return a JSON object with the following format:
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
        content: `Create animations for these elements: ${request.selectedElements.join(', ')}
Description: "${request.description}"

Elements that should NOT be animated: ${request.referenceElements?.join(', ') || 'none'}

${simplifiedSvg}`
      }
    ];

    console.log('OpenAI Request:', {
      selectedElements: request.selectedElements,
      referenceElements: request.referenceElements,
      description: request.description,
      debugInfo
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

    const result = JSON.parse(content);

    // Insert the animations into the original SVG
    const animatedSvg = insertAnimations(request.svgContent, result.animations);

    console.log('Animation Generation Result:', {
      numAnimations: result.animations.length,
      explanation: result.explanation
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