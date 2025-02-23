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

      if (selectable) {
        console.log('Processing SVG for selectable elements...');

        // Extract style definitions
        const styleMatch = processedSvg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
        const styleDefinitions: Record<string, string> = {};
        if (styleMatch) {
          console.log('Found style definitions in SVG');
          const styleContent = styleMatch[1];
          const styleRules = styleContent.match(/\.[^{]+{[^}]+}/g) || [];
          styleRules.forEach(rule => {
            const [selector, styles] = rule.split('{');
            styleDefinitions[selector.trim().slice(1)] = styles.slice(0, -1).trim();
          });
        }

        // Function to check if an element or its parent is hidden
        const isHidden = (element: string): boolean => {
          // Check inline styles
          const styleMatch = element.match(/style="([^"]*)"/);
          if (styleMatch) {
            const style = styleMatch[1];
            if (style.includes('display:none') ||
                style.includes('display: none') ||
                /opacity:\s*0(?:\.0+)?/.test(style) ||
                (style.includes('fill:none') && style.includes('stroke:none')) ||
                (style.includes('fill: none') && style.includes('stroke: none'))) {
              return true;
            }
          }

          // Check class references
          const classMatch = element.match(/class="([^"]*)"/);
          if (classMatch) {
            const classes = classMatch[1].split(/\s+/);
            for (const className of classes) {
              const styleRule = styleDefinitions[className];
              if (styleRule && (
                  styleRule.includes('display:none') ||
                  styleRule.includes('display: none') ||
                  /opacity:\s*0(?:\.0+)?/.test(styleRule) ||
                  (styleRule.includes('fill:none') && styleRule.includes('stroke:none')) ||
                  (styleRule.includes('fill: none') && styleRule.includes('stroke: none'))
              )) {
                return true;
              }
            }
          }

          return false;
        };

        // Process SVG to make elements selectable
        const processedLines = processedSvg.split('\n').map(line => {
          if (isHidden(line)) return line;

          // Make elements with IDs selectable
          return line.replace(
            /<(path|circle|rect|ellipse|polygon|polyline|line)\s+([^>]*?)(?:id="([^"]*)")?([^>]*?)>/g,
            (match, tagName, beforeId, id, afterId) => {
              if (!id) return match;

              const isSelected = selectedElements.has(id);
              const selectionStyle = isSelected ? 'stroke: #4299e1 !important; stroke-width: 2px !important;' : '';

              // Clean up existing styles and add selection style
              const existingStyleMatch = match.match(/style="([^"]*)"/);
              let cleanStyle = '';
              if (existingStyleMatch) {
                cleanStyle = existingStyleMatch[1]
                  .replace(/cursor:\s*pointer;?\s*/g, '')
                  .replace(/stroke:\s*#4299e1;?\s*/g, '')
                  .replace(/stroke-width:\s*2px?;?\s*/g, '')
                  .trim();
              }

              const newStyle = `${cleanStyle}${cleanStyle ? '; ' : ''}cursor: pointer; ${selectionStyle}`.trim();

              // Remove any existing style attribute from both parts
              let cleanedBeforeId = beforeId.replace(/style="[^"]*"/, '').trim();
              let cleanedAfterId = afterId.replace(/style="[^"]*"/, '').trim();

              return `<${tagName} ${cleanedBeforeId} id="${id}" style="${newStyle}" data-selectable="true" ${cleanedAfterId}>`;
            }
          );
        });

        processedSvg = processedLines.join('\n');
      }

      setSanitizedSvg(processedSvg);
      setError(null);
    } catch (err) {
      console.error('SVG Processing Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process SVG');
      setSanitizedSvg(null);
    }
  }, [svg, selectable, selectedElements]);

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
            className="w-full h-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: sanitizedSvg || '' }}
          />
        )}
      </Card>
    </div>
  );
}