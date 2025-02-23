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
  const [key, setKey] = useState(0); // Force re-render on selection changes

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

      if (selectable) {
        console.log('Processing SVG for selectable elements...');

        // Process SVG to make elements selectable
        const processedLines = processedSvg.split('\n').map(line => {
          return line.replace(
            /<(path|circle|rect|ellipse|polygon|polyline|line)\s+([^>]*?)(?:id="([^"]*)")?([^>]*?)>/g,
            (match, tagName, beforeId, id, afterId) => {
              if (!id) return match;

              const isSelected = selectedElements.has(id);
              console.log(`Processing element ${id}, selected: ${isSelected}`);

              // Clean up existing styles
              const existingStyleMatch = match.match(/style="([^"]*)"/);
              let existingStyle = existingStyleMatch ? existingStyleMatch[1] : '';

              // Build enhanced selection style with important flags
              const selectionStyles = isSelected ? `
                stroke: #4299e1 !important;
                stroke-width: 2px !important;
                stroke-opacity: 1 !important;
                pointer-events: all !important;
                cursor: pointer !important;
              ` : 'cursor: pointer !important;';

              // Combine styles, ensuring selection styles take precedence
              const combinedStyle = `${existingStyle}; ${selectionStyles}`.trim();

              // Remove any existing style attributes and reconstruct element
              let cleanedBeforeId = beforeId.replace(/style="[^"]*"/, '').trim();
              let cleanedAfterId = afterId.replace(/style="[^"]*"/, '').trim();

              const result = `<${tagName} ${cleanedBeforeId} id="${id}" style="${combinedStyle}" data-selectable="true" ${cleanedAfterId}>`;

              console.log(`Styled element ${id}:`, result);
              return result;
            }
          );
        });

        processedSvg = processedLines.join('\n');
      }

      setSanitizedSvg(processedSvg);
      setError(null);
      setKey(prev => prev + 1); // Force re-render when SVG changes
    } catch (err) {
      console.error('SVG Processing Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process SVG');
      setSanitizedSvg(null);
    }
  }, [svg, selectable, selectedElements]); // Re-run when selection changes

  const findSelectableElement = (element: HTMLElement): HTMLElement | null => {
    let current: HTMLElement | null = element;

    while (current) {
      const id = current.getAttribute('id');
      console.log('Checking element:', {
        tagName: current.tagName,
        id,
        isSelectable: current.getAttribute('data-selectable')
      });

      if (id && ['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line']
          .includes(current.tagName.toLowerCase())) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!selectable || !onElementSelect) {
      console.log('Click ignored - selection not enabled');
      return;
    }

    const target = event.target as HTMLElement;
    console.log('Click event details:', {
      tagName: target.tagName,
      id: target.id,
      className: target.className,
      attributes: Array.from(target.attributes).map(attr => `${attr.name}="${attr.value}"`),
      parentElement: target.parentElement ? {
        tagName: target.parentElement.tagName,
        id: target.parentElement.id
      } : null
    });

    const selectableElement = findSelectableElement(target);
    if (selectableElement) {
      const id = selectableElement.id;
      console.log('Found selectable element:', {
        id,
        tagName: selectableElement.tagName,
        currentlySelected: selectedElements.has(id)
      });
      onElementSelect(id);

      // Force re-render after selection
      setKey(prev => prev + 1);
    } else {
      console.log('No selectable element found in click path');
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
            key={key} // Force re-render when selection changes
            className="w-full h-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: sanitizedSvg || '' }}
          />
        )}
      </Card>
    </div>
  );
}