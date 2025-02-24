import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";

interface SVGPreviewProps {
  svg: string | null;
  title: string;
  selectable?: boolean;
  onElementSelect?: (elementId: string) => void;
  selectedElements?: string[];
  referenceElements?: string[];
  selectionMode?: 'animate' | 'reference';
  className?: string;
}

function processSvg(
  svg: string | null,
  selectable: boolean,
  selectedElements: string[],
  referenceElements: string[],
  selectionMode: 'animate' | 'reference'
): { svg: string | null; error: string | null } {
  if (!svg) return { svg: null, error: null };

  try {
    if (!svg.includes('<svg')) {
      throw new Error('Invalid SVG format');
    }

    let processedSvg = svg;

    // Parse original viewBox
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    let viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

    // Use original viewBox or calculate from dimensions
    if (!viewBox) {
      const widthMatch = svg.match(/width="([^"]+)"/);
      const heightMatch = svg.match(/height="([^"]+)"/);
      if (widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1]);
        const height = parseFloat(heightMatch[1]);
        viewBox = `0 0 ${width} ${height}`;
      } else {
        viewBox = "-20 -20 250 250";
      }
    }

    // Add padding for selection highlights in selectable mode
    if (selectable) {
      const [x, y, width, height] = viewBox.split(' ').map(Number);
      const padding = Math.max(width, height) * 0.1;
      viewBox = `${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`;
    }

    // Update SVG attributes to ensure proper scaling and centering
    processedSvg = processedSvg.replace(/<svg([^>]*)>/, (match, attributes) => {
      let newAttributes = attributes
        .replace(/width="[^"]*"/g, '')
        .replace(/height="[^"]*"/g, '')
        .replace(/viewBox="[^"]*"/g, '')
        .replace(/preserveAspectRatio="[^"]*"/g, '')
        .replace(/style="[^"]*"/g, '');

      return `<svg${newAttributes} 
        viewBox="${viewBox}" 
        preserveAspectRatio="xMidYMid meet" 
        style="width: 100%; height: 100%; display: block;"
      >`;
    });

    // Add selection styling if in selectable mode
    if (selectable || selectedElements.length > 0 || referenceElements.length > 0) {
      processedSvg = processedSvg.replace(
        /<(path|circle|rect|ellipse|polygon|polyline|line)([^>]*?)>/g,
        (match, tagName, attributes) => {
          const idMatch = attributes.match(/id="([^"]+)"/);
          if (!idMatch) {
            return match;
          }

          const id = idMatch[1];
          const isSelected = selectedElements.includes(id);
          const isReference = referenceElements.includes(id);
          const isSelectable = !isReference && selectionMode === 'animate' || !isSelected && selectionMode === 'reference';

          const styleMatch = attributes.match(/style="([^"]+)"/);
          const existingStyles = styleMatch ? styleMatch[1] : '';

          let newStyles = existingStyles;
          if (isSelectable) {
            newStyles += '; pointer-events: all !important; cursor: pointer !important;';
          }

          if (isSelected) {
            newStyles += `
              ; stroke: #4299e1 !important
              ; stroke-width: 2 !important
              ; stroke-opacity: 1 !important
              ; fill-opacity: 0.8 !important
            `;
          } else if (isReference) {
            newStyles += `
              ; stroke: #10b981 !important
              ; stroke-width: 2 !important
              ; stroke-opacity: 1 !important
              ; fill-opacity: 0.8 !important
            `;
          }

          // Store original style for extraction but don't affect display
          if (styleMatch && !attributes.includes('data-original-style')) {
            attributes = attributes.replace(styleMatch[0], `data-original-style="${existingStyles}" ${styleMatch[0]}`);
          }

          const newAttributes = styleMatch
            ? attributes.replace(/style="[^"]+"/g, `style="${newStyles}"`)
            : attributes + ` style="${newStyles}"`;

          return `<${tagName}${newAttributes}>`;
        }
      );
    }

    return { svg: processedSvg, error: null };
  } catch (error) {
    console.error('SVG Processing Error:', error);
    return {
      svg: null,
      error: error instanceof Error ? error.message : 'Failed to process SVG'
    };
  }
}

export function SVGPreview({
  svg,
  title,
  selectable = false,
  onElementSelect,
  selectedElements = [],
  referenceElements = [],
  selectionMode = 'animate',
  className = ""
}: SVGPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  const { svg: processedSvg, error: processError } = useMemo(() => {
    return processSvg(svg, selectable, selectedElements, referenceElements, selectionMode);
  }, [svg, selectable, selectedElements, referenceElements, selectionMode]);

  useMemo(() => {
    setError(processError);
  }, [processError]);

  const handleClick = (event: React.MouseEvent) => {
    if (!selectable || !onElementSelect) return;

    const target = event.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'svg') return;

    let current: HTMLElement | null = target;
    while (current && current.tagName.toLowerCase() !== 'svg') {
      if (current.id) {
        onElementSelect(current.id);
        break;
      }
      current = current.parentElement;
    }
  };

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lg">{title}</h3>
          {selectable && (
            <p className="text-sm text-muted-foreground">
              {selectionMode === 'animate'
                ? "Click on elements to select them for animation"
                : "Click on elements to add reference points"}
            </p>
          )}
        </div>
      )}
      <Card
        className={`overflow-hidden ${className} ${selectable ? 'p-4' : ''}`}
        onClick={handleClick}
      >
        {error ? (
          <p className="text-destructive p-4">{error}</p>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: processedSvg || '' }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}