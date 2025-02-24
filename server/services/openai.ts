import OpenAI from "openai";
import { AnimationParams, Message } from "@shared/schema";
import { JSDOM } from "jsdom";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AnimationRequest {
  svgContent: string;
  selectedElements: string[];
  referenceElements?: string[];  // Added referenceElements
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

// Helper function to get element details
function getElementDetails(document: Document, id: string): string {
  const element = document.getElementById(id);
  if (!element) return id;

  const tag = element.tagName.toLowerCase();
  const x = element.getAttribute('x') || element.getAttribute('cx') || '0';
  const y = element.getAttribute('y') || element.getAttribute('cy') || '0';

  return `#${id} (${tag} at x=${x}, y=${y})`;
}

export async function generateAnimation(request: AnimationRequest): Promise<AnimationResponse> {
  try {
    const dom = new JSDOM(request.svgContent);
    const document = dom.window.document;

    // Create detailed context for elements
    const elementsToAnimate = request.selectedElements
      .map(id => getElementDetails(document, id))
      .join(', ');

    // Create context for reference elements
    const referenceContext = request.referenceElements?.length
      ? `Reference elements that should NOT be animated: ${
          request.referenceElements.map(id => getElementDetails(document, id)).join(', ')
        }`
      : '';

    // Include previous conversation context
    const conversationContext = request.conversation?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    const messages = [
      {
        role: "system",
        content: `You are an expert in SVG SMIL animations. Your task is to generate animation elements for specific SVG elements.
${referenceContext}

Return a JSON object with an 'animations' array containing objects with:
- elementId: the ID of the element to animate
- animations: array of SMIL animation strings to add to that element

IMPORTANT RULES:
1. ONLY generate animations for the explicitly listed elements to animate
2. DO NOT modify or animate any reference elements
3. Use the reference elements' positions and attributes as spatial anchors
4. Keep the reference elements completely static

Example format:
{
  "animations": [
    {
      "elementId": "circle1",
      "animations": [
        "<animate attributeName='r' values='20;40;20' dur='2s' repeatCount='indefinite'/>",
        "<animateTransform attributeName='transform' type='rotate' from='0' to='360' dur='3s' repeatCount='indefinite'/>"
      ]
    }
  ],
  "parameters": {
    "duration": 2,
    "easing": "ease",
    "repeat": 0,
    "direction": "normal"
  },
  "explanation": "Brief description of the animation approach"
}`
      },
      ...conversationContext,
      {
        role: "user",
        content: `Create SMIL animations for these elements: ${elementsToAnimate}
Animation description: ${request.description}
${request.parameters ? `Current parameters: ${JSON.stringify(request.parameters)}` : ''}`
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

    // Validate that no reference elements are being animated
    if (request.referenceElements?.length) {
      const attemptedReferenceAnimations = result.animations
        .filter(a => request.referenceElements?.includes(a.elementId));

      if (attemptedReferenceAnimations.length > 0) {
        throw new Error("Animation attempt on reference elements detected");
      }
    }

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

export function extractSelectedElements(svgContent: string, elementIds: string[]): string {
  const dom = new JSDOM(svgContent);
  const document = dom.window.document;

  // Extract viewBox and other necessary attributes from original SVG
  const originalSvg = document.querySelector('svg');
  if (!originalSvg) throw new Error("Invalid SVG: no svg element found");

  const viewBox = originalSvg.getAttribute('viewBox');
  const width = originalSvg.getAttribute('width');
  const height = originalSvg.getAttribute('height');

  // Create a new minimal SVG with only selected elements
  const minimalSvg = document.createElement('svg');
  minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (viewBox) minimalSvg.setAttribute('viewBox', viewBox);
  if (width) minimalSvg.setAttribute('width', width);
  if (height) minimalSvg.setAttribute('height', height);

  // Copy selected elements
  for (const id of elementIds) {
    const element = document.getElementById(id);
    if (element) {
      minimalSvg.appendChild(element.cloneNode(true));
    }
  }

  return minimalSvg.outerHTML;
}