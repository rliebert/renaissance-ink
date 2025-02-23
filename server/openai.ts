import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSvgAnimation(svg: string, description: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in SVG animations. Generate SMIL or CSS animations for SVG files based on descriptions. Output valid SVG code with animations only."
        },
        {
          role: "user",
          content: `Original SVG:\n${svg}\n\nDescription: ${description}\n\nPlease generate an animated version of this SVG according to the description. Return only the complete SVG code with animations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || '';
  } catch (error: any) {
    throw new Error(`Failed to generate animation: ${error?.message || 'Unknown error'}`);
  }
}