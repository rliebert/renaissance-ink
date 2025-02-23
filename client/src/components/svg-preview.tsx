import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface SVGPreviewProps {
  svg: string | null;
  title: string;
}

export function SVGPreview({ svg, title }: SVGPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [sanitizedSvg, setSanitizedSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!svg) {
      setSanitizedSvg(null);
      setError(null);
      return;
    }

    try {
      // Basic SVG validation and sanitization
      if (!svg.includes('<svg')) {
        throw new Error('Invalid SVG format');
      }

      // Ensure SVG has width/height or viewBox
      let processedSvg = svg;
      if (!svg.includes('width=') && !svg.includes('viewBox=')) {
        processedSvg = processedSvg.replace('<svg', '<svg width="100%" height="100%"');
      }

      // Preserve animations by keeping <style> and <defs> tags
      setSanitizedSvg(processedSvg);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process SVG');
      setSanitizedSvg(null);
    }
  }, [svg]);

  if (!svg) {
    return (
      <Card className="w-full h-[300px] flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">No SVG to preview</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-lg">{title}</h3>
      <Card className="w-full min-h-[300px] p-4 flex items-center justify-center overflow-hidden">
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