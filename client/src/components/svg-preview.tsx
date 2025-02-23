import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface SVGPreviewProps {
  svg: string | null;
  title: string;
  selectable?: boolean;
  onElementSelect?: (elementId: string) => void;
  selectedElements?: Set<string>;
}

export function SVGPreview({ 
  svg, 
  title, 
  selectable = false,
  onElementSelect,
  selectedElements = new Set()
}: SVGPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [sanitizedSvg, setSanitizedSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!svg) {
      setSanitizedSvg(null);
      setError(null);
      return;
    }

    try {
      // Basic SVG validation
      if (!svg.includes('<svg')) {
        throw new Error('Invalid SVG format');
      }

      // Ensure SVG has width/height or viewBox
      let processedSvg = svg;
      if (!svg.includes('width=') && !svg.includes('viewBox=')) {
        processedSvg = processedSvg.replace('<svg', '<svg width="100%" height="100%"');
      }

      // If selectable, add click handlers to visible SVG elements
      if (selectable) {
        // First, make all elements unselectable by default
        processedSvg = processedSvg.replace(
          /<(?:path|circle|rect|ellipse|polygon|polyline|line|g)[^>]*>/g,
          match => match.replace(/data-selectable="true"/, '').replace(/ style="[^"]*"/, '')
        );

        // Remove hidden groups and their contents
        processedSvg = processedSvg.replace(
          /<g[^>]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0|display="none"|visibility="hidden"|opacity="0")[^>]*>[\s\S]*?<\/g>/g,
          ''
        );

        // Remove individual hidden elements
        processedSvg = processedSvg.replace(
          /<(?:path|circle|rect|ellipse|polygon|polyline|line)(?:[^>]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0|display="none"|visibility="hidden"|opacity="0")[^>]*)\/?>(?:<\/(?:path|circle|rect|ellipse|polygon|polyline|line)>)?/g,
          ''
        );

        // Then, make only visible elements selectable
        processedSvg = processedSvg.replace(
          /<(?:path|circle|rect|ellipse|polygon|polyline|line|g)[^>]*?id="[^"]*"[^>]*>/g,
          (match) => {
            // Skip if element is within a hidden group
            if (match.includes('display:none') || 
                match.includes('visibility:hidden') || 
                match.includes('opacity:0') ||
                match.includes('display="none"') || 
                match.includes('visibility="hidden"') || 
                match.includes('opacity="0"')) {
              return match;
            }

            // Extract id if present
            const idMatch = match.match(/id="([^"]*)"/);
            if (!idMatch) return match;

            const id = idMatch[1];
            const isSelected = selectedElements.has(id);

            // Preserve existing style attribute if present
            const existingStyle = match.match(/style="([^"]*)"/)?.[1] || '';
            const combinedStyle = `${existingStyle}${existingStyle ? '; ' : ''}cursor: pointer;${isSelected ? ' outline: 2px solid #4299e1;' : ''}`;

            // Add selectable attribute and styling while preserving original attributes
            return match.replace(
              /(\s*)(\/?>|>)$/,
              ` style="${combinedStyle}" data-selectable="true"$2`
            );
          }
        );
      }

      setSanitizedSvg(processedSvg);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process SVG');
      setSanitizedSvg(null);
    }
  }, [svg, selectable, selectedElements]);

  const handleClick = (event: React.MouseEvent) => {
    if (!selectable || !onElementSelect) return;

    const target = event.target as HTMLElement;
    if (target.getAttribute('data-selectable') === 'true') {
      const id = target.getAttribute('id');
      if (id) {
        onElementSelect(id);
      }
    }
  };

  if (!svg) {
    return (
      <Card className="w-full h-[300px] flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">No SVG to preview</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">{title}</h3>
        {selectable && (
          <p className="text-sm text-muted-foreground">
            Click on visible elements to select them for animation
          </p>
        )}
      </div>
      <Card 
        className="w-full min-h-[300px] p-4 flex items-center justify-center overflow-hidden"
        onClick={handleClick}
      >
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: sanitizedSvg || '' }}
          />
        )}
      </Card>
    </div>
  );
}