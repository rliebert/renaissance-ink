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

      setSanitizedSvg(processedSvg);
      setError(null);
      setKey(prev => prev + 1);
    } catch (error) {
      console.error('SVG Processing Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process SVG');
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
  const svgWrapperClass = "w-full h-full flex items-center justify-center p-4";
  const svgClass = "max-w-full max-h-full w-auto h-auto";

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
        className={`overflow-hidden ${containerClass} ${!className.includes('aspect-square') ? 'min-h-[300px]' : ''}`}
        onClick={handleClick}
      >
        {error ? (
          <p className="text-destructive p-4">{error}</p>
        ) : (
          <div
            key={key}
            className={svgWrapperClass}
          >
            <div 
              className={svgClass}
              dangerouslySetInnerHTML={{ __html: sanitizedSvg || '' }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}