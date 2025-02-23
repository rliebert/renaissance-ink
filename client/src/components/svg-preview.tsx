import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface SVGPreviewProps {
  svg: string | null;
  title: string;
  selectable?: boolean;
  onElementSelect?: (elementId: string) => void;
  selectedElements?: Set<string>;
  className?: string;
}

export function SVGPreview({
  svg,
  title,
  selectable = false,
  onElementSelect,
  selectedElements = new Set(),
  className = ""
}: SVGPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [sanitizedSvg, setSanitizedSvg] = useState<string | null>(null);
  const [svgViewBox, setSvgViewBox] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!svg) {
      setSanitizedSvg(null);
      setError(null);
      return;
    }

    try {
      if (!svg.includes('<svg')) {
        throw new Error('Invalid SVG format');
      }

      let processedSvg = svg;

      // Extract viewBox from original SVG
      const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;
      setSvgViewBox(viewBox);

      // Add viewBox if missing, using width/height if available
      if (!viewBox) {
        const widthMatch = svg.match(/width="([^"]+)"/);
        const heightMatch = svg.match(/height="([^"]+)"/);
        if (widthMatch && heightMatch) {
          const width = parseFloat(widthMatch[1]);
          const height = parseFloat(heightMatch[1]);
          processedSvg = processedSvg.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
        } else {
          // Default viewBox if no dimensions found
          processedSvg = processedSvg.replace('<svg', '<svg viewBox="0 0 100 100"');
        }
      }

      if (selectable) {
        processedSvg = processedSvg.replace(
          /<(path|circle|rect|ellipse|polygon|polyline|line)([^>]*?)>/g,
          (match, tagName, attributes) => {
            const idMatch = attributes.match(/id="([^"]+)"/);
            if (!idMatch) {
              return match;
            }

            const id = idMatch[1];
            const isSelected = selectedElements.has(id);

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

      setSanitizedSvg(processedSvg);
      setError(null);
      setKey(prev => prev + 1);
    } catch (err) {
      console.error('SVG Processing Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process SVG');
      setSanitizedSvg(null);
    }
  }, [svg, selectable, selectedElements]);

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

  const containerClass = `relative ${className}`;
  const svgContainerClass = svgViewBox 
    ? "w-full h-full" 
    : "flex items-center justify-center min-h-[200px]";

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
        className={`overflow-hidden ${containerClass}`}
        onClick={handleClick}
      >
        {error ? (
          <p className="text-destructive p-4">{error}</p>
        ) : (
          <div
            key={key}
            className={svgContainerClass}
            dangerouslySetInnerHTML={{ __html: sanitizedSvg || '' }}
          />
        )}
      </Card>
    </div>
  );
}