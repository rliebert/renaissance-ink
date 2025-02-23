import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface SVGPreviewProps {
  svg: string | null;
  title: string;
}

export function SVGPreview({ svg, title }: SVGPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
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
            dangerouslySetInnerHTML={{ __html: svg }}
            onError={() => setError("Failed to render SVG")}
          />
        )}
      </Card>
    </div>
  );
}
