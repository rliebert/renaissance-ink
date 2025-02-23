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
      if (!svg.includes('width=') && !svg.includes('viewBox=')) {
        processedSvg = processedSvg.replace('<svg', '<svg width="100%" height="100%"');
      }

      if (selectable) {
        console.log('Processing SVG for selectable elements...', {
          selectedElementsCount: selectedElements.size,
          selectedElementsList: Array.from(selectedElements)
        });

        processedSvg = processedSvg.replace(
          /<(path|circle|rect|ellipse|polygon|polyline|line)([^>]*?)>/g,
          (match, tagName, attributes) => {
            // Extract id if it exists
            const idMatch = attributes.match(/id="([^"]+)"/);
            if (!idMatch) {
              return match; // Keep original if no id
            }

            const id = idMatch[1];
            const isSelected = selectedElements.has(id);

            console.log(`Processing element ${id}:`, {
              isSelected,
              originalAttributes: attributes
            });

            // Extract existing style if present
            const styleMatch = attributes.match(/style="([^"]+)"/);
            const existingStyles = styleMatch ? styleMatch[1] : '';

            // Build new style string
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

            // Replace or add style attribute
            const newAttributes = styleMatch
              ? attributes.replace(/style="[^"]+"/g, `style="${newStyles}"`)
              : attributes + ` style="${newStyles}"`;

            const elementStr = `<${tagName}${newAttributes}>`;

            // For selected elements, wrap in a group with highlight effect
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

            console.log('Generated element:', elementStr);
            return elementStr;
          }
        );

        console.log('Final processed SVG length:', processedSvg.length);
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
        console.log('Found valid SVG element:', current.id);
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!selectable || !onElementSelect) return;

    const target = event.target as HTMLElement;
    console.log('Click event details:', {
      target: target.tagName.toLowerCase(),
      id: target.id,
      attrs: Array.from(target.attributes)
    });

    const selectableElement = findSelectableElement(target);
    if (selectableElement) {
      const id = selectableElement.id;
      console.log('Found selectable element:', {
        id,
        currentlySelected: selectedElements.has(id)
      });
      onElementSelect(id);

      console.log('Selection updated:', {
        id,
        newSelectionState: !selectedElements.has(id),
        totalSelected: selectedElements.size
      });
    } else {
      console.log('No selectable element found');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">{title}</h3>
        {selectable && (
          <p className="text-sm text-muted-foreground">
            Click on elements to select them for animation
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
            key={key}
            className="w-full h-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: sanitizedSvg || '' }}
          />
        )}
      </Card>
    </div>
  );
}