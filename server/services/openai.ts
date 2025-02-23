import OpenAI from "openai";
import { AnimationParams, Message } from "@shared/schema";
import { JSDOM } from "jsdom";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AnimationRequest {
  svgContent: string;
  selectedElements: string[];
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

export async function generateAnimation(request: AnimationRequest): Promise<AnimationResponse> {
  try {
    // Create a focused prompt that describes the elements to animate
    const elementsContext = request.selectedElements
      .map(id => {
        const dom = new JSDOM(request.svgContent);
        const element = dom.window.document.getElementById(id);
        return element ? `#${id} (${element.tagName.toLowerCase()})` : `#${id}`;
      })
      .join(', ');

    // Include previous conversation context
    const conversationContext = request.conversation?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in SVG SMIL animations. Your task is to generate animation elements for specific SVG elements.
Return a JSON object with an 'animations' array containing objects with:
- elementId: the ID of the element to animate
- animations: array of SMIL animation strings to add to that element
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
          content: `Create SMIL animations for these elements: ${elementsContext}
Animation description: ${request.description}
${request.parameters ? `Current parameters: ${JSON.stringify(request.parameters)}` : ''}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    const result = JSON.parse(content);

    // Insert the animations into the original SVG
    const animatedSvg = insertAnimations(request.svgContent, result.animations);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate animation: ${errorMessage}`);
  }
}

function extractSelectedElements(svgContent: string, elementIds: string[]): string {
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