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

function mergeSvgContent(originalSvg: string, animatedSvg: string): string {
  try {
    // Extract all paths from original SVG
    const originalPaths: { [key: string]: string } = {};
    const pathMatches = originalSvg.matchAll(/<path[^>]*id="([^"]*)"[^>]*>/g);
    for (const match of pathMatches) {
      originalPaths[match[1]] = match[0];
    }

    // Replace omitted content in animated SVG
    let mergedSvg = animatedSvg;

    // Handle all variations of omitted content comments
    const omittedContentRegex = /<!--\s*(?:Other\s+)?(?:paths|content|elements|groups|sections)\s+omitted.*?-->/g;

    mergedSvg = mergedSvg.replace(
      omittedContentRegex,
      (match, offset) => {
        // Find the closest parent g element
        const beforeComment = mergedSvg.slice(0, offset);
        const gStart = beforeComment.lastIndexOf('<g');
        const gEnd = mergedSvg.indexOf('</g>', offset);

        if (gStart === -1 || gEnd === -1) return '';

        // Get the g element's content
        const gContent = mergedSvg.slice(gStart, gEnd);

        // Find paths that are already included
        const includedPaths = new Set<string>();
        const pathRegex = /id="([^"]*)"/g;
        let pathMatch;
        while ((pathMatch = pathRegex.exec(gContent)) !== null) {
          includedPaths.add(pathMatch[1]);
        }

        // Add missing paths from original
        const missingPaths = Object.entries(originalPaths)
          .filter(([id]) => !includedPaths.has(id))
          .map(([, path]) => path)
          .join('\n');

        return missingPaths;
      }
    );

    return mergedSvg;
  } catch (error) {
    console.error('Error merging SVG content:', error);
    return animatedSvg; // Return the animated SVG as-is if merging fails
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
          content: `You are an expert in SVG animations. Generate SMIL or CSS animations for SVG files based on descriptions. 
When parts of the SVG are omitted for brevity, always use the exact comment format: 
<!-- paths omitted for brevity -->
This helps our system correctly replace the omitted content. Output valid SVG code with animations only.`
        },
        {
          role: "user",
          content: `Original SVG:\n${cleanedSvg}\n\nDescription: ${description}\n\nPlease generate an animated version of this SVG according to the description. When omitting content for brevity, use EXACTLY the comment <!-- paths omitted for brevity --> to mark omitted sections. Return only the complete SVG code with animations.`
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

    // Merge the generated SVG with the original to fill in any omitted content
    const mergedSvg = mergeSvgContent(svg, generatedSvg);

    return mergedSvg;
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to generate animation: ${error?.message || 'Unknown error'}`);
  }
}