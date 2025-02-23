import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cleanupSvg(svg: string): string {
  // Remove comments
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');

  // Remove unnecessary whitespace
  svg = svg.replace(/>\s+</g, '><');

  // Remove empty groups
  svg = svg.replace(/<g[^>]*>\s*<\/g>/g, '');

  return svg.trim();
}

export async function generateSvgAnimation(svg: string, description: string): Promise<string> {
  try {
    // Clean up SVG before processing
    const cleanedSvg = cleanupSvg(svg);

    // Rough token estimation (4 chars ≈ 1 token)
    const estimatedTokens = (cleanedSvg.length + description.length) / 4;
    if (estimatedTokens > 6000) { // Leave room for system message and response
      throw new Error("SVG file is too large. Please use a simpler SVG file.");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert in SVG animations. Generate SMIL or CSS animations for SVG files based on descriptions. Output valid SVG code with animations only."
        },
        {
          role: "user",
          content: `Original SVG:\n${cleanedSvg}\n\nDescription: ${description}\n\nPlease generate an animated version of this SVG according to the description. Return only the complete SVG code with animations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const generatedSvg = response.choices[0].message.content;
    if (!generatedSvg) {
      throw new Error("No SVG animation generated");
    }

    // Basic validation to ensure it's an SVG
    if (!generatedSvg.includes('<svg')) {
      throw new Error("Generated content is not a valid SVG");
    }

    return generatedSvg;
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to generate animation: ${error?.message || 'Unknown error'}`);
  }
}