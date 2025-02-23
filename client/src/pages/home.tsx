import { useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertAnimationSchema, type Animation, type Message } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SVGPreview } from "@/components/svg-preview";
import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  const { toast } = useToast();
  const [originalSvg, setOriginalSvg] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [conversation, setConversation] = useState<Message[]>([]);

  // Memoize selected elements for stable query key
  const selectedElementsKey = useMemo(
    () => selectedElements.sort().join(','),
    [selectedElements]
  );

  const form = useForm({
    resolver: zodResolver(insertAnimationSchema),
    defaultValues: {
      originalSvg: "",
      description: "",
    },
  });

  // Query for selected elements preview
  const previewQuery = useQuery({
    queryKey: ['svg-preview', selectedElementsKey],
    queryFn: async () => {
      if (!originalSvg || selectedElements.length === 0) {
        return null;
      }

      try {
        const response = await apiRequest("POST", "/api/svg/preview", {
          svgContent: originalSvg,
          selectedElements
        });

        if (!response.ok) {
          throw new Error('Failed to generate preview');
        }

        const data = await response.json();
        return data.preview as string;
      } catch (error) {
        console.error('Preview generation error:', error);
        return null;
      }
    },
    enabled: !!originalSvg && selectedElements.length > 0
  });

  const mutation = useMutation({
    mutationFn: async (data: { originalSvg: string; description: string }) => {
      const payload = {
        ...data,
        selectedElements,
      };
      const response = await apiRequest("POST", "/api/animations", payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate animation');
      }
      return response.json() as Promise<Animation>;
    },
    onSuccess: (data) => {
      setConversation(prev => [...prev,
        {
          role: "user",
          content: form.getValues("description"),
          timestamp: new Date(),
        },
        {
          role: "assistant",
          content: data.explanation || "I've generated the animation based on your description.",
          timestamp: new Date(),
        }
      ]);
    },
    onError: (error: Error) => {
      setConversation(prev => [...prev,
        {
          role: "user",
          content: form.getValues("description"),
          timestamp: new Date(),
        },
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          timestamp: new Date(),
        }
      ]);
    },
  });

  const handleElementSelect = useCallback((elementId: string) => {
    setSelectedElements(prev => {
      const index = prev.indexOf(elementId);
      return index >= 0 
        ? prev.filter(id => id !== elementId)
        : [...prev, elementId];
    });
  }, []);

  const handleSendMessage = (content: string) => {
    if (selectedElements.length === 0) {
      setConversation(prev => [...prev,
        {
          role: "user",
          content,
          timestamp: new Date(),
        },
        {
          role: "assistant",
          content: "Please select at least one element to animate first.",
          timestamp: new Date(),
        }
      ]);
      return;
    }

    form.setValue("description", content);
    form.handleSubmit((data) => mutation.mutate(data))();
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

    try {
      const text = await file.text();
      setOriginalSvg(text);
      form.setValue("originalSvg", text);
      setSelectedElements([]);
      setConversation([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error reading file",
        description: "Failed to read the SVG file",
      });
    }
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
          <div>
            <SVGPreview
              svg={originalSvg}
              title="Original SVG"
              selectable={true}
              onElementSelect={handleElementSelect}
              selectedElements={selectedElements}
            />
          </div>

          <ChatInterface
            messages={conversation}
            onSendMessage={handleSendMessage}
            isLoading={mutation.isPending}
            animatedSvg={mutation.data?.animatedSvg}
            previewSvg={previewQuery.data}
          />
        </div>

        {/* Debug information */}
        <div className="mt-8 p-4 bg-muted rounded-lg space-y-4">
          <h3 className="font-semibold">Debug Information</h3>
          <div className="space-y-2">
            <p className="text-sm font-medium">Last OpenAI Prompt:</p>
            <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
              {mutation.variables ? JSON.stringify({
                description: mutation.variables.description,
                selectedElements: Array.from(selectedElements),
              }, null, 2) : 'No prompt sent yet'}
            </pre>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Last OpenAI Response:</p>
            <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
              {mutation.data ? JSON.stringify({
                animatedSvg: mutation.data.animatedSvg?.substring(0, 100) + '...',
                explanation: mutation.data.explanation,
              }, null, 2) : 'No response yet'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}