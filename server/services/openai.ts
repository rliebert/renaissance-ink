import OpenAI from "openai";
import { AnimationParams, Message } from "@shared/schema";
import { JSDOM } from "jsdom";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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

// Helper function to get element details including coordinates
function getElementDetails(document: Document, id: string): string {
  const element = document.getElementById(id);
  if (!element) return id;

  const tag = element.tagName.toLowerCase();
  const x = element.getAttribute('x') || element.getAttribute('cx') || '0';
  const y = element.getAttribute('y') || element.getAttribute('cy') || '0';
  const transform = element.getAttribute('transform') || '';

  return `#${id} (${tag} at x=${x}, y=${y}${transform ? `, transform=${transform}` : ''})`;
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
    selectedElements: elementIds.map(id => {
      const element = document.getElementById(id);
      return {
        id,
        tag: element?.tagName.toLowerCase(),
        x: element?.getAttribute('x') || element?.getAttribute('cx'),
        y: element?.getAttribute('y') || element?.getAttribute('cy'),
        transform: element?.getAttribute('transform'),
      };
    }),
  };

  // Create a new minimal SVG with only selected elements
  const minimalSvg = document.createElement('svg');
  minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (debug.originalViewBox) minimalSvg.setAttribute('viewBox', debug.originalViewBox);
  if (debug.originalWidth) minimalSvg.setAttribute('width', debug.originalWidth);
  if (debug.originalHeight) minimalSvg.setAttribute('height', debug.originalHeight);

  // Copy selected elements, preserving their original styles and coordinates
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

  console.log('Extracted SVG Debug:', {
    input: {
      elementIds,
      svgContentLength: svgContent.length,
    },
    output: {
      minimalSvgLength: minimalSvg.outerHTML.length,
      debug
    }
  });

  return {
    svg: minimalSvg.outerHTML,
    debug: JSON.stringify(debug, null, 2)
  };
}

export async function generateAnimation(request: AnimationRequest): Promise<AnimationResponse> {
  try {
    const dom = new JSDOM(request.svgContent);
    const document = dom.window.document;

    // Create detailed context for elements
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
      simplifiedSvgInfo: debugInfo
    });

    // Include previous conversation context
    const conversationContext = request.conversation?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    const messages = [
      {
        role: "system",
        content: `You are an expert in SVG SMIL animations. Return only the complete SVG with animations added to specified elements.

Requirements:
1. Return ONLY the complete SVG code with animations
2. Preserve XML declaration and all original attributes
3. Add animations ONLY to specified elements
4. Keep all other elements unchanged
5. No comments, explanations, or code blocks - just SVG code`
      },
      ...conversationContext,
      {
        role: "user",
        content: `Create animations for these elements (${elementsToAnimate})${referencePoints}: "${request.description}"

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
      messages: messages as any, // Type assertion needed due to OpenAI types
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