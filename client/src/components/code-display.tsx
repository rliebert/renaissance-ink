import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodeDisplayProps {
  code: string | null;
}

export function CodeDisplay({ code }: CodeDisplayProps) {
  const { toast } = useToast();

  if (!code) {
    return null;
  }

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Animation code copied to clipboard",
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">Generated Animation Code</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={copyCode}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
      <Card className="w-full">
        <pre className="p-4 overflow-x-auto">
          <code className="text-sm">{code}</code>
        </pre>
      </Card>
    </div>
  );
}
