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
        console.log('Processing SVG for selectable elements...');

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

              // Add selection styles that combine both stroke and outline for better visibility
              const selectionStyles = isSelected ? `
                stroke: #4299e1 !important;
                stroke-width: 2px !important;
                stroke-opacity: 1 !important;
                outline: 2px solid #4299e1 !important;
                outline-offset: 2px !important;
                pointer-events: all !important;
              ` : '';

              // Clean up existing styles
              let cleanedBeforeId = beforeId.replace(/style="[^"]*"/, '').trim();
              let cleanedAfterId = afterId.replace(/style="[^"]*"/, '').trim();

              // Combine cursor style with selection styles
              const styles = `cursor: pointer !important; ${selectionStyles}`.trim();

              const result = `<${tagName} ${cleanedBeforeId} id="${id}" style="${styles}" ${cleanedAfterId}>`;
              console.log('Generated element:', result);
              return result;
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
      target: target.tagName,
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
      setKey(prev => prev + 1);
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