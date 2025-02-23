import OpenAI from "openai";
import { AnimationParams, Message } from "@shared/schema";

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

export async function generateAnimation(request: AnimationRequest): Promise<AnimationResponse> {
  try {
    const conversationContext = request.conversation?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert SVG animator. Generate SMIL animations for SVG elements based on natural language descriptions.
          Focus on creating smooth, visually appealing animations that match the user's intent.
          Always return a valid SVG with SMIL animations in JSON format.`
        },
        ...conversationContext,
        {
          role: "user",
          content: JSON.stringify({
            svg: request.svgContent,
            elementsToAnimate: request.selectedElements,
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

    return {
      animatedSvg: result.animatedSvg,
      suggestedParams: {
        duration: result.parameters.duration || 1,
        easing: result.parameters.easing || 'ease',
        repeat: result.parameters.repeat || 0,
        direction: result.parameters.direction || 'normal'
      },
      explanation: result.explanation
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate animation: ${errorMessage}`);
  }
}