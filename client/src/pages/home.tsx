import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertAnimationSchema, type Animation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SVGPreview } from "@/components/svg-preview";
import { CodeDisplay } from "@/components/code-display";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const [originalSvg, setOriginalSvg] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(insertAnimationSchema),
    defaultValues: {
      originalSvg: "",
      description: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { originalSvg: string; description: string }) => {
      const res = await apiRequest("POST", "/api/animations", data);
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

    // Add file size check
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
  };

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">SVG Animation Generator</h1>
          <p className="text-muted-foreground">
            Upload an SVG file and describe how you want it animated
          </p>
        </div>

        {/* Add tips section */}
        <div className="bg-muted p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Tips for best results:</h2>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Use simple SVG files with clear shapes and paths</li>
            <li>Keep file size under 2MB</li>
            <li>Remove unnecessary elements and groups from your SVG</li>
            <li>Provide clear animation instructions in the description</li>
          </ul>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <Input
                type="file"
                accept=".svg"
                onChange={onFileChange}
                className="mb-4"
              />
              <Textarea
                placeholder="Describe how you want the SVG to be animated... (e.g., 'Make the circle bounce up and down')"
                {...form.register("description")}
                className="min-h-[100px]"
              />
            </div>

            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate Animation
            </Button>
          </form>
        </Form>

        <div className="grid md:grid-cols-2 gap-8">
          <SVGPreview svg={originalSvg} title="Original SVG" />
          <SVGPreview
            svg={mutation.data?.animatedSvg || null}
            title="Animated Preview"
          />
        </div>

        <CodeDisplay code={mutation.data?.animatedSvg || null} />
      </div>
    </div>
  );
}