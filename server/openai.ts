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

function validateSvgStructure(svg: string): string {
  // Ensure XML declaration is present
  if (!svg.startsWith('<?xml')) {
    svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svg;
  }

  // Extract SVG tag with all its attributes
  const svgTagMatch = svg.match(/<svg[^>]*>/);
  if (!svgTagMatch) {
    throw new Error("Invalid SVG: missing svg tag");
  }

  // Ensure all namespaces are present
  const svgTag = svgTagMatch[0];
  const requiredNamespaces = [
    'xmlns="http://www.w3.org/2000/svg"',
    'xmlns:svg="http://www.w3.org/2000/svg"',
    'xmlns:xlink="http://www.w3.org/1999/xlink"'
  ];

  let updatedSvgTag = svgTag;
  for (const ns of requiredNamespaces) {
    if (!updatedSvgTag.includes(ns.split('=')[0] + '=')) {
      updatedSvgTag = updatedSvgTag.replace('>', ` ${ns}>`);
    }
  }

  return svg.replace(svgTag, updatedSvgTag);
}

export async function generateSvgAnimation(svg: string, description: string): Promise<string> {
  try {
    // Clean up SVG before processing
    const cleanedSvg = cleanupSvg(svg);

    // Token estimation
    const svgTokens = Math.ceil(cleanedSvg.length / 3);
    const descriptionTokens = Math.ceil(description.length / 4);
    const totalTokens = svgTokens + descriptionTokens;

    if (totalTokens > 7000) {
      throw new Error("SVG file is too complex. Please simplify the SVG or break it into smaller parts.");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an SVG animation expert specializing in SMIL animations.
CRITICAL REQUIREMENTS:
1. Return ONLY the complete SVG code with animations
2. Do NOT use ANY comments or omissions - include every single path and element
3. Preserve the EXACT XML declaration from the original SVG
4. Maintain ALL original attributes and namespaces in the svg tag
5. Only add animation elements (<animate>, <animateTransform>, etc.) to existing paths
6. Keep ALL original IDs, classes, and styles
7. Ensure the SVG structure matches the original EXACTLY
8. No markdown, no code blocks, no explanations - just pure SVG code`
        },
        {
          role: "user",
          content: `Animate this SVG according to this description: "${description}"

${cleanedSvg}

Return the complete SVG with ALL original elements and added animations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const generatedSvg = response.choices[0].message.content;
    if (!generatedSvg) {
      throw new Error("No SVG animation generated");
    }

    // Basic validation
    if (!generatedSvg.includes('<svg')) {
      throw new Error("Generated content is not a valid SVG");
    }

    // Extract just the SVG if it's wrapped in any markdown
    const svgMatch = generatedSvg.match(/<\?xml[\s\S]*<\/svg>/);
    const cleanGeneratedSvg = svgMatch ? svgMatch[0] : generatedSvg;

    // Validate and fix SVG structure
    const validatedSvg = validateSvgStructure(cleanGeneratedSvg);

    return validatedSvg;
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to generate animation: ${error?.message || 'Unknown error'}`);
  }
}