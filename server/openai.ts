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

  // Extract attributes using regular expressions
  const originalAttrs: Record<string, string> = {};
  const originalMatches = Array.from(originalSvgTag.matchAll(/(\w+:?\w+)="([^"]*)"/g));
  originalMatches.forEach(m => originalAttrs[m[1]] = m[2]);

  const newAttrs: Record<string, string> = {};
  const newMatches = Array.from(newSvgTag.matchAll(/(\w+:?\w+)="([^"]*)"/g));
  newMatches.forEach(m => newAttrs[m[1]] = m[2]);

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

export async function generateSvgAnimation(
  svg: string, 
  description: string,
  selectedElements: string[] = []
): Promise<string> {
  try {
    // Clean up SVG before processing
    const cleanedSvg = cleanupSvg(svg);

    // Create a more focused prompt based on selected elements
    const elementsList = selectedElements.length > 0 
      ? selectedElements.map(id => `#${id}`).join(', ')
      : 'all elements';

    // Token estimation
    const svgTokens = Math.ceil(cleanedSvg.length / 3);
    const descriptionTokens = Math.ceil(description.length / 4);
    const totalTokens = svgTokens + descriptionTokens;

    // GPT-4's context window is 8192 tokens, we need to leave room for:
    // - System message (~200 tokens)
    // - Response completion (~2000 tokens)
    // - Safety margin (~500 tokens)
    const maxInputTokens = 5000;

    if (totalTokens > maxInputTokens) {
      throw new Error("SVG file is too complex. Please simplify the SVG or break it into smaller parts.");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert autonomous programmer specializing in SVG animations.
CRITICAL REQUIREMENTS:
1. Return ONLY the complete SVG code with animations
2. Do NOT use ANY comments or omissions
3. Preserve the EXACT XML declaration
4. Maintain ALL original attributes in the svg tag
5. Add animation elements ONLY to the specified elements: ${elementsList}
6. Keep ALL original elements exactly as they are
7. No markdown, no code blocks, no explanations - just pure SVG code
8. NEVER truncate or omit any content`
        },
        {
          role: "user",
          content: `Apply this animation to these elements (${elementsList}): "${description}"

${cleanedSvg}

Return the complete SVG with animations applied only to the specified elements.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
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