import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { z } from "zod";
import type { Message } from "@shared/schema";
import { SVGPreview } from "./svg-preview";

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
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  animatedSvg,
  previewSvg 
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
                {/* Show preview above user message if it's the latest message */}
                {message.role === "user" && index === messages.length - 1 && previewSvg && (
                  <div className="mb-2 p-2 rounded bg-background/50">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 w-2 bg-primary rounded-full animate-pulse"/>
                      <p className="text-xs opacity-70">Elements to animate:</p>
                    </div>
                    <div className="w-24 h-24 mx-auto">
                      <SVGPreview
                        svg={previewSvg}
                        title=""
                        className="aspect-square"
                      />
                    </div>
                  </div>
                )}

                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Show animated result below assistant message */}
                {message.role === "assistant" && index === messages.length - 1 && animatedSvg && (
                  <div className="mt-4 p-2 rounded bg-background/50">
                    <p className="text-xs mb-2 opacity-70">Generated Animation:</p>
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

          {/* Show loading animation */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Generating animation...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-4">
        {/* Show selected elements above input */}
        {previewSvg && (
          <div className="p-2 border rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse"/>
              <p className="text-xs text-muted-foreground">Ready to animate:</p>
            </div>
            <div className="w-24 h-24 mx-auto">
              <SVGPreview
                svg={previewSvg}
                title=""
                className="aspect-square"
              />
            </div>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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