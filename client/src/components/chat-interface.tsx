import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
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
      {/* Show preview at top if available */}
      {previewSvg && (
        <div className="p-4 border-b">
          <SVGPreview
            svg={previewSvg}
            title="Selected Elements"
          />
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
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <span className="text-xs opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {/* Show animation preview after the last assistant message */}
          {animatedSvg && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="flex justify-start">
              <div className="rounded-lg p-4 bg-muted max-w-[80%]">
                <SVGPreview
                  svg={animatedSvg}
                  title="Generated Animation"
                />
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
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send
            </Button>
          </form>
        </Form>
      </div>
    </Card>
  );
}