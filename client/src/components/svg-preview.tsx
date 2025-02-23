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
        // Extract style definitions
        const styleMatch = processedSvg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
        const styleDefinitions: Record<string, string> = {};
        if (styleMatch) {
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

          // Check direct attributes
          if (element.includes('display="none"') || 
              element.includes('opacity="0"') ||
              (element.includes('fill="none"') && element.includes('stroke="none"'))) {
            return true;
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

        // Split SVG into lines to check parent visibility
        const lines = processedSvg.split('\n');
        const visibilityStack: boolean[] = [true];
        const processedLines = lines.map(line => {
          if (line.includes('</g>')) {
            visibilityStack.pop();
            return line;
          }

          if (line.includes('<g')) {
            const parentVisible = visibilityStack[visibilityStack.length - 1];
            const currentVisible = parentVisible && !isHidden(line);
            visibilityStack.push(currentVisible);
            return line;
          }

          const parentVisible = visibilityStack[visibilityStack.length - 1];
          if (!parentVisible || isHidden(line)) {
            return line;
          }

          // Make visible elements with IDs selectable
          return line.replace(
            /(<(?:path|circle|rect|ellipse|polygon|polyline|line)[^>]*?)(id="[^"]*")([^>]*?>)/g,
            (match, prefix, idAttr, suffix) => {
              const id = idAttr.split('"')[1];
              const isSelected = selectedElements.has(id);

              // Preserve existing style while adding selection styles
              let existingStyle = match.match(/style="([^"]*)"/)?.[1] || '';
              if (existingStyle) {
                existingStyle = existingStyle.replace(/cursor:\s*pointer;?\s*/, '');
                existingStyle = existingStyle.replace(/stroke:\s*#4299e1;?\s*/, '');
                existingStyle = existingStyle.replace(/stroke-width:\s*2;?\s*/, '');
                existingStyle = existingStyle.trim();
              }

              const selectionStyle = isSelected ? ' !important; stroke: #4299e1 !important; stroke-width: 2px !important' : '';
              const combinedStyle = `${existingStyle}${existingStyle ? ';' : ''}cursor: pointer${selectionStyle}`.trim();

              return `${prefix}${idAttr} style="${combinedStyle}" data-selectable="true"${suffix}`;
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

  const handleClick = (event: React.MouseEvent) => {
    if (!selectable || !onElementSelect) return;

    const target = event.target as HTMLElement;
    console.log('Click target:', target);
    console.log('Is selectable:', target.getAttribute('data-selectable'));
    console.log('Element ID:', target.getAttribute('id'));

    if (target.getAttribute('data-selectable') === 'true') {
      const id = target.getAttribute('id');
      if (id) {
        console.log('Selecting element:', id);
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