import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Download, ExternalLink } from "lucide-react";
import { z } from "zod";
import type { Message } from "@shared/schema";
import { SVGPreview } from "./svg-preview";
import { LoadingIndicator } from "./loading-indicator";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";

const messageSchema = z.object({
  content: z.string().min(1, "Please enter a message"),
});

type MessageFormData = z.infer<typeof messageSchema>;

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string, loopAnimation?: boolean) => void;
  isLoading?: boolean;
  animatedSvg?: string | null;
  originalSvg: string | null;
  selectedElements: string[];
  referenceElements: string[];
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  animatedSvg,
  originalSvg,
  selectedElements = [],
  referenceElements = [],
}: ChatInterfaceProps) {
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      content: "",
    },
  });

  const [loopAnimation, setLoopAnimation] = useState(true);

  // Fetch selected elements preview
  useEffect(() => {
    async function fetchPreview() {
      if (!originalSvg || (!selectedElements.length && !referenceElements.length)) {
        setPreviewSvg(null);
        return;
      }

      try {
        const response = await apiRequest("POST", "/api/animations/preview", {
          svgContent: originalSvg,
          selectedElements,
          referenceElements,
        });

        if (!response.ok) {
          throw new Error('Failed to generate preview');
        }

        const data = await response.json();
        setPreviewSvg(data.preview);
      } catch (error) {
        console.error('Preview generation error:', error);
        setPreviewSvg(null);
      }
    }

    fetchPreview();
  }, [originalSvg, selectedElements, referenceElements]);

  const onSubmit = (data: MessageFormData) => {
    onSendMessage(data.content, loopAnimation);
    form.reset();
  };

  const handleDownload = (svg: string) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animated-svg.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewInNewTab = (svg: string) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const showPreview = previewSvg && (selectedElements.length > 0 || referenceElements.length > 0);

  return (
    <Card className="flex flex-col h-[500px] relative">
      {showPreview && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 rounded-lg shadow-lg border p-4 w-64">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-2">
                {selectedElements.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse"/>
                    <p className="text-xs text-muted-foreground">To animate</p>
                  </div>
                )}
                {selectedElements.length > 0 && referenceElements.length > 0 && (
                  <span className="text-xs text-muted-foreground">·</span>
                )}
                {referenceElements.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"/>
                    <p className="text-xs text-muted-foreground">Reference</p>
                  </div>
                )}
              </div>
            </div>
            <div className="aspect-square bg-background rounded-lg">
              <div className="w-full h-full flex items-center justify-center p-2">
                <SVGPreview
                  svg={previewSvg}
                  title=""
                  className="w-full h-full"
                  selectable={false}
                  selectedElements={selectedElements}
                  referenceElements={referenceElements}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] space-y-2 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {message.role === "assistant" && index === messages.length - 1 && animatedSvg && (
                  <div className="mt-4 p-2 rounded bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs opacity-70">Generated Animation:</p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDownload(animatedSvg)}
                          title="Download SVG"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleViewInNewTab(animatedSvg)}
                          title="View in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="w-full max-w-[200px] mx-auto">
                      <SVGPreview
                        svg={animatedSvg}
                        title=""
                        className="aspect-square"
                      />
                    </div>
                  </div>
                )}

                <span className="text-xs opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 bg-muted">
                <div className="flex items-center gap-4">
                  <LoadingIndicator />
                  <p className="text-sm">Generating animation...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Describe how you want to animate the selected elements..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox 
                id="loopAnimation"
                checked={loopAnimation}
                onCheckedChange={(checked) => setLoopAnimation(checked as boolean)}
              />
              <label
                htmlFor="loopAnimation"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Loop Animation
              </label>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingIndicator className="w-4 h-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </form>
        </Form>
      </div>
    </Card>
  );
}