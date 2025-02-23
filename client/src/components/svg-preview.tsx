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

        const processedLines = processedSvg.split('\n').map(line => {
          return line.replace(
            /<(path|circle|rect|ellipse|polygon|polyline|line)\s+([^>]*?)(?:id="([^"]*)")?([^>]*?)>/g,
            (match, tagName, beforeId, id, afterId) => {
              if (!id) {
                console.log('Element without ID found:', match);
                return match;
              }

              const isSelected = selectedElements.has(id);
              console.log(`Processing element ${id}, selected:`, isSelected);

              // Remove any existing style attributes
              let cleanedBeforeId = beforeId.replace(/style="[^"]*"/, '').trim();
              let cleanedAfterId = afterId.replace(/style="[^"]*"/, '').trim();

              // Base element with pointer events and cursor
              const baseElement = `<${tagName} ${cleanedBeforeId} id="${id}" 
                fill-opacity="${isSelected ? '0.8' : '1'}"
                style="pointer-events: all; cursor: pointer;"
                ${cleanedAfterId}>`;

              if (isSelected) {
                // Wrap selected elements in a group with highlight effects
                return `
                  <g class="selected-element">
                    <${tagName} 
                      ${cleanedBeforeId}
                      style="pointer-events: none; fill: none; stroke: #4299e1; stroke-width: 8; stroke-opacity: 0.3;"
                      ${cleanedAfterId}
                    />
                    ${baseElement}
                    <${tagName}
                      ${cleanedBeforeId}
                      style="pointer-events: none; fill: none; stroke: #4299e1; stroke-width: 2; stroke-opacity: 1;"
                      ${cleanedAfterId}
                    />
                  </g>`;
              }

              return baseElement;
            }
          );
        });

        processedSvg = processedLines.join('\n');
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
      console.log('Checking element:', {
        tagName: current.tagName.toLowerCase(),
        id: current.id,
        attributes: Array.from(current.attributes).map(a => `${a.name}="${a.value}"`).join(', ')
      });

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
      attrs: Array.from(target.attributes).map(a => `${a.name}="${a.value}"`)
    });

    const selectableElement = findSelectableElement(target);
    if (selectableElement) {
      const id = selectableElement.id;
      console.log('Found selectable element:', {
        id,
        currentlySelected: selectedElements.has(id)
      });
      onElementSelect(id);

      // Log selection state after update
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