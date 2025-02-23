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

function validateSvgStructure(svg: string, originalSvg: string): string {
  // Ensure XML declaration is present and matches original
  const xmlDeclaration = originalSvg.match(/<\?xml[^>]*\?>/)?.[0];
  if (xmlDeclaration && !svg.startsWith(xmlDeclaration)) {
    svg = xmlDeclaration + '\n' + svg.replace(/<\?xml[^>]*\?>/, '');
  }

  // Extract SVG tag with all its attributes from both SVGs
  const originalSvgTag = originalSvg.match(/<svg[^>]*>/)?.[0];
  const newSvgTag = svg.match(/<svg[^>]*>/)?.[0];

  if (!originalSvgTag || !newSvgTag) {
    throw new Error("Invalid SVG: missing svg tag");
  }

  // Preserve original SVG attributes while keeping any new animation-related attributes
  const originalAttrs = Object.fromEntries(
    [...originalSvgTag.matchAll(/(\w+:?\w+)="([^"]*)"/g)].map(m => [m[1], m[2]])
  );
  const newAttrs = Object.fromEntries(
    [...newSvgTag.matchAll(/(\w+:?\w+)="([^"]*)"/g)].map(m => [m[1], m[2]])
  );

  // Merge attributes, prioritizing original attributes except for animation-related ones
  const mergedAttrs = { ...newAttrs, ...originalAttrs };

  // Reconstruct SVG tag
  const mergedSvgTag = '<svg ' + Object.entries(mergedAttrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ') + '>';

  // Replace SVG tag
  svg = svg.replace(/<svg[^>]*>/, mergedSvgTag);

  // Ensure SVG has proper closing tag
  if (!svg.endsWith('</svg>')) {
    svg += '</svg>';
  }

  return svg;
}

function verifyCompleteSvg(svg: string): boolean {
  // Check for well-formed XML structure
  const hasXmlDeclaration = /<\?xml[^>]*\?>/.test(svg);
  const hasOpeningSvgTag = /<svg[^>]*>/.test(svg);
  const hasClosingSvgTag = /<\/svg>/.test(svg);

  // Check for balanced tags
  const openTags = svg.match(/<[^/][^>]*>/g) || [];
  const closeTags = svg.match(/<\/[^>]+>/g) || [];

  // Count only unique tags (excluding self-closing)
  const openCount = openTags.filter(tag => !tag.endsWith('/>'));
  const closeCount = closeTags.length;

  return hasXmlDeclaration && 
         hasOpeningSvgTag && 
         hasClosingSvgTag && 
         openCount.length === closeCount;
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
8. No markdown, no code blocks, no explanations - just pure SVG code
9. Do NOT truncate or omit any parts of the SVG`
        },
        {
          role: "user",
          content: `Animate this SVG according to this description: "${description}"

${cleanedSvg}

Return the complete SVG with ALL original elements and added animations. Do not truncate or omit any content.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const generatedSvg = response.choices[0].message.content;
    if (!generatedSvg) {
      throw new Error("No SVG animation generated");
    }

    // Extract just the SVG if it's wrapped in any markdown
    const svgMatch = generatedSvg.match(/<\?xml[\s\S]*<\/svg>/);
    const cleanGeneratedSvg = svgMatch ? svgMatch[0] : generatedSvg;

    // Verify the SVG is complete
    if (!verifyCompleteSvg(cleanGeneratedSvg)) {
      throw new Error("Generated SVG is incomplete or malformed");
    }

    // Validate and fix SVG structure while preserving original attributes
    const validatedSvg = validateSvgStructure(cleanGeneratedSvg, svg);

    return validatedSvg;
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to generate animation: ${error?.message || 'Unknown error'}`);
  }
}