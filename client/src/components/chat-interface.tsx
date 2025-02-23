import { useState } from "react";
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

const messageSchema = z.object({
  content: z.string().min(1, "Please enter a message"),
});

type MessageFormData = z.infer<typeof messageSchema>;

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  animatedSvg?: string | null;
  previewSvg?: string | null;
  referenceSvg?: string | null;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  animatedSvg,
  previewSvg,
  referenceSvg
}: ChatInterfaceProps) {
  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      content: "",
    },
  });

  const onSubmit = (data: MessageFormData) => {
    onSendMessage(data.content);
    form.reset();
  };

  const handleDownload = (svg: string) => {
    console.log('Downloading SVG:', {
      length: svg.length,
      containsAnimate: svg.includes('<animate'),
      containsAnimateTransform: svg.includes('<animateTransform'),
      preview: svg.substring(0, 200) + '...'
    });

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
    console.log('Opening SVG in new tab:', {
      length: svg.length,
      containsAnimate: svg.includes('<animate'),
      containsAnimateTransform: svg.includes('<animateTransform'),
      preview: svg.substring(0, 200) + '...'
    });

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Card className="flex flex-col h-[500px]">
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
                {message.role === "user" && index === messages.length - 1 && (previewSvg || referenceSvg) && (
                  <div className="mb-2 p-2 rounded bg-background/50 space-y-4">
                    {previewSvg && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 bg-primary rounded-full animate-pulse"/>
                          <p className="text-xs opacity-70">Selected elements:</p>
                        </div>
                        <div className="w-24 h-24 mx-auto bg-background rounded-lg">
                          <div className="w-full h-full flex items-center justify-center pt-1 pb-3">
                            <SVGPreview
                              svg={previewSvg}
                              title=""
                              className="w-full h-full"
                              selectable={false}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {referenceSvg && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"/>
                          <p className="text-xs opacity-70">Selected ref(s):</p>
                        </div>
                        <div className="w-24 h-24 mx-auto bg-background rounded-lg">
                          <div className="w-full h-full flex items-center justify-center pt-1 pb-3">
                            <SVGPreview
                              svg={referenceSvg}
                              title=""
                              className="w-full h-full"
                              selectable={false}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

      <div className="p-4 border-t space-y-4">
        {(previewSvg || referenceSvg) && (
          <div className="p-2 border rounded-lg bg-muted space-y-4">
            {previewSvg && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse"/>
                  <p className="text-xs text-muted-foreground">Selected elements:</p>
                </div>
                <div className="w-24 h-24 mx-auto bg-background rounded-lg">
                  <div className="w-full h-full flex items-center justify-center pt-1 pb-3">
                    <SVGPreview
                      svg={previewSvg}
                      title=""
                      className="w-full h-full"
                      selectable={false}
                    />
                  </div>
                </div>
              </div>
            )}
            {referenceSvg && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"/>
                  <p className="text-xs text-muted-foreground">Selected ref(s):</p>
                </div>
                <div className="w-24 h-24 mx-auto bg-background rounded-lg">
                  <div className="w-full h-full flex items-center justify-center pt-1 pb-3">
                    <SVGPreview
                      svg={referenceSvg}
                      title=""
                      className="w-full h-full"
                      selectable={false}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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