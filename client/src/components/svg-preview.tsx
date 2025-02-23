import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";

interface SVGPreviewProps {
  svg: string | null;
  title: string;
  selectable?: boolean;
  onElementSelect?: (elementId: string) => void;
  selectedElements?: string[];
  className?: string;
}

function processSvg(
  svg: string | null, 
  selectable: boolean, 
  selectedElements: string[]
): { svg: string | null; error: string | null } {
  if (!svg) return { svg: null, error: null };

  try {
    if (!svg.includes('<svg')) {
      throw new Error('Invalid SVG format');
    }

    let processedSvg = svg;

    // Extract viewBox from original SVG
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    let viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

    // Parse viewBox values if they exist
    let x = 0, y = 0, width = 100, height = 100;
    if (viewBox) {
      [x, y, width, height] = viewBox.split(' ').map(Number);
    } else {
      // Try to get dimensions from width/height attributes
      const widthMatch = svg.match(/width="([^"]+)"/);
      const heightMatch = svg.match(/height="([^"]+)"/);
      if (widthMatch && heightMatch) {
        width = parseFloat(widthMatch[1]);
        height = parseFloat(heightMatch[1]);
      }
    }

    // Add consistent 10% padding to viewBox
    const padding = 0.1;
    const paddedX = x - width * padding;
    const paddedY = y - height * padding;
    const paddedWidth = width * (1 + 2 * padding);
    const paddedHeight = height * (1 + 2 * padding);

    // Update viewBox with padding
    const newViewBox = `${paddedX} ${paddedY} ${paddedWidth} ${paddedHeight}`;
    processedSvg = processedSvg.replace(/viewBox="[^"]*"/, `viewBox="${newViewBox}"`);
    if (!viewBoxMatch) {
      processedSvg = processedSvg.replace('<svg', `<svg viewBox="${newViewBox}"`);
    }

    // Ensure proper aspect ratio and sizing
    processedSvg = processedSvg.replace(/<svg([^>]*)>/, (match, attributes) => {
      let newAttributes = attributes
        .replace(/width="[^"]*"/g, '')
        .replace(/height="[^"]*"/g, '')
        .replace(/preserveAspectRatio="[^"]*"/g, '');
      return `<svg${newAttributes} preserveAspectRatio="xMidYMid meet">`;
    });

    // Add selection styling if in selectable mode
    if (selectable) {
      processedSvg = processedSvg.replace(
        /<(path|circle|rect|ellipse|polygon|polyline|line)([^>]*?)>/g,
        (match, tagName, attributes) => {
          const idMatch = attributes.match(/id="([^"]+)"/);
          if (!idMatch) {
            return match;
          }

          const id = idMatch[1];
          const isSelected = selectedElements.includes(id);

          const styleMatch = attributes.match(/style="([^"]+)"/);
          const existingStyles = styleMatch ? styleMatch[1] : '';

          let newStyles = existingStyles;
          newStyles += '; pointer-events: all !important; cursor: pointer !important;';

          if (isSelected) {
            newStyles += `
              ; stroke: #4299e1 !important
              ; stroke-width: 2 !important
              ; stroke-opacity: 1 !important
              ; fill-opacity: 0.8 !important
            `;
          }

          const newAttributes = styleMatch
            ? attributes.replace(/style="[^"]+"/g, `style="${newStyles}"`)
            : attributes + ` style="${newStyles}"`;

          const elementStr = `<${tagName}${newAttributes}>`;

          if (isSelected) {
            return `
              <g class="selected-element-group">
                <${tagName}${attributes.replace(/style="[^"]+"/g, '')}
                  style="
                    pointer-events: none !important;
                    fill: none !important;
                    stroke: #4299e1 !important;
                    stroke-width: 6 !important;
                    stroke-opacity: 0.3 !important;
                  "
                />
                ${elementStr}
              </g>
            `;
          }

          return elementStr;
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
  className = ""
}: SVGPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  const { svg: processedSvg, error: processError } = useMemo(() => {
    return processSvg(svg, selectable, selectedElements);
  }, [svg, selectable, selectedElements]);

  useMemo(() => {
    setError(processError);
  }, [processError]);

  const findSelectableElement = (element: HTMLElement): HTMLElement | null => {
    let current: HTMLElement | null = element;
    while (current) {
      if (current.id && ['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line']
          .includes(current.tagName.toLowerCase())) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!selectable || !onElementSelect) return;

    const target = event.target as HTMLElement;
    const selectableElement = findSelectableElement(target);
    if (selectableElement) {
      onElementSelect(selectableElement.id);
    }
  };

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lg">{title}</h3>
          {selectable && (
            <p className="text-sm text-muted-foreground">
              Click on elements to select them for animation
            </p>
          )}
        </div>
      )}
      <Card
        className={`overflow-hidden ${className} ${!className.includes('aspect-square') ? 'min-h-[300px]' : ''}`}
        onClick={handleClick}
      >
        {error ? (
          <p className="text-destructive p-4">{error}</p>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4">
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