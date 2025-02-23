import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertAnimationSchema, type Animation, type Message } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SVGPreview } from "@/components/svg-preview";
import { ChatInterface } from "@/components/chat-interface";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const [originalSvg, setOriginalSvg] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  const [conversation, setConversation] = useState<Message[]>([]);

  const form = useForm({
    resolver: zodResolver(insertAnimationSchema),
    defaultValues: {
      originalSvg: "",
      description: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { originalSvg: string; description: string }) => {
      const payload = {
        ...data,
        selectedElements: Array.from(selectedElements),
      };
      const res = await apiRequest("POST", "/api/animations", payload);
      return res.json() as Promise<Animation>;
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error,
        });
      } else {
        // Update conversation with the new messages
        setConversation([
          ...conversation,
          {
            role: "user",
            content: form.getValues("description"),
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "I've generated the animation based on your description.",
            timestamp: new Date(),
          },
        ]);

        toast({
          title: "Success",
          description: "Animation generated successfully",
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleElementSelect = (elementId: string) => {
    setSelectedElements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return newSet;
    });
  };

  const handleSendMessage = (content: string) => {
    form.setValue("description", content);
    form.handleSubmit((data) => {
      if (selectedElements.size === 0) {
        toast({
          variant: "destructive",
          title: "No elements selected",
          description: "Please select at least one element to animate",
        });
        return;
      }
      mutation.mutate(data);
    })();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("svg")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload an SVG file",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please use a simpler SVG file (max 2MB)",
      });
      return;
    }

    const text = await file.text();
    setOriginalSvg(text);
    form.setValue("originalSvg", text);
    setSelectedElements(new Set());
    setConversation([]);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">SVG Animation Generator</h1>
          <p className="text-muted-foreground">
            Upload an SVG file, select elements to animate, and describe how you want them animated
          </p>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Tips for best results:</h2>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Click on SVG elements to select them for animation</li>
            <li>Selected elements will be highlighted in blue</li>
            <li>Keep file size under 2MB</li>
            <li>Provide clear animation instructions in the chat</li>
          </ul>
        </div>

        <Input
          type="file"
          accept=".svg"
          onChange={onFileChange}
          className="w-full"
        />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <SVGPreview 
              svg={originalSvg} 
              title="Original SVG" 
              selectable={true}
              onElementSelect={handleElementSelect}
              selectedElements={selectedElements}
            />
            <SVGPreview
              svg={mutation.data?.animatedSvg || null}
              title="Animated Preview"
            />
          </div>

          <ChatInterface
            messages={conversation}
            onSendMessage={handleSendMessage}
            isLoading={mutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}