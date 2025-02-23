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

function mergeAnimatedElements(originalSvg: string, animatedElements: string): string {
  const dom = new JSDOM(originalSvg);
  const document = dom.window.document;

  // Parse animated elements
  const animatedDom = new JSDOM(animatedElements);
  const animatedDoc = animatedDom.window.document;

  // Extract animation definitions
  const defs = animatedDoc.querySelector('defs');
  if (defs) {
    const originalDefs = document.querySelector('defs') || document.querySelector('svg').appendChild(document.createElement('defs'));
    originalDefs.innerHTML += defs.innerHTML;
  }

  // Replace original elements with animated versions
  const animatedElements = animatedDoc.querySelectorAll('[id]');
  animatedElements.forEach(animatedEl => {
    const id = animatedEl.getAttribute('id');
    const originalEl = document.getElementById(id);
    if (originalEl) {
      originalEl.parentNode.replaceChild(document.importNode(animatedEl, true), originalEl);
    }
  });

  return document.querySelector('svg').outerHTML;
}

export async function generateAnimation(request: AnimationRequest): Promise<AnimationResponse> {
  try {
    // Extract only selected elements
    const minimalSvg = extractSelectedElements(request.svgContent, request.selectedElements);

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
          content: `You are an expert in SVG animations. Your task is to add SMIL animations to the provided SVG elements.
Return a valid SVG with animations in JSON format. Focus only on animating the provided elements.
Important: Preserve all element IDs and attributes.`
        },
        ...conversationContext,
        {
          role: "user",
          content: JSON.stringify({
            svg: minimalSvg,
            description: request.description,
            currentParams: request.parameters
          })
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    const result = JSON.parse(content);

    // Merge animated elements back into original SVG
    const finalSvg = mergeAnimatedElements(request.svgContent, result.animatedSvg);

    return {
      animatedSvg: finalSvg,
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