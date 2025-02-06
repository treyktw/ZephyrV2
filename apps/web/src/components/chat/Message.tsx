// components/chat/Message.tsx
import { memo } from "react";
import { Message } from "@/types/chat.types";
import { cn } from "@/lib/utils";
import { Loader2, Maximize2 } from "lucide-react";
import { CodeBlock } from "@/components/ui/code-block";
import { Button } from "../ui/button";
import { ViewCode } from "./ViewCode";
import { useArtifact } from "@/hooks/useArtifact";
import { nanoid } from "nanoid";

interface ChatMessageProps {
  message: Message;
  onRetry?: () => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onRetry,
}: ChatMessageProps) {
  const isError = message.type === "error";
  const isLoading = message.type === "loading";
  const { addArtifact, openArtifact } = useArtifact();

  // Function to create and open a code artifact
  const handleExpandCode = (content: string, language: string) => {
    const artifactId = nanoid();
    const artifact = {
      id: artifactId,
      content,
      type: "code" as const,
      title: `${language} Example`,
      metadata: {
        language,
        fileName: `example.${language}`,
      },
    };

    // Add to store and open viewer
    addArtifact(artifact);
    openArtifact(artifact);
  };

  // Function to parse code blocks from message content
  const parseCodeBlocks = (content: string) => {
    const parts = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: "code",
        language: match[1] || "plaintext",
        content: match[2],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex),
      });
    }

    return parts;
  };

  // Render message content with ViewCode buttons and code blocks
  const renderContent = (content: string) => {
    console.log('Rendering content:', content);
    // First split on ViewCode placeholders (keeping this part as it works well)
    const parts = content.split(/(<ViewCode id="[^"]+" \/>)/);

    return parts.map((part, index) => {
      // Handle ViewCode components (keeping this unchanged)
      const viewCodeMatch = part.match(/^<ViewCode id="([^"]+)" \/>$/);
      if (viewCodeMatch) {
        const artifactId = viewCodeMatch[1];
        return <ViewCode key={index} id={artifactId} />;
      }

      // For regular text content, we need to handle both HTML formatting and code blocks
      const codeParts = parseCodeBlocks(part);

      return codeParts.map((codePart, codeIndex) => {
        if (codePart.type === "code") {
          // Code block rendering remains the same
          return (
            <div key={`${index}-${codeIndex}`} className="relative my-4">
              <div className="absolute right-2 top-2 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    handleExpandCode(
                      codePart.content,
                      codePart.language || "plaintext",
                    )
                  }
                >
                  <Maximize2 className="h-4 w-4" />
                  Expand
                </Button>
              </div>
              <CodeBlock
                language={codePart.language ?? "plaintext"}
                code={codePart.content}
                filename={`example.${codePart.language ?? "plaintext"}`}
              />
            </div>
          );
        }

        // For text content, we now use dangerouslySetInnerHTML to render the formatted HTML
        return (
          <div
            key={`${index}-${codeIndex}`}
            className="prose prose-sm dark:prose-invert max-w-none space-y-2 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: codePart.content
            }}
          />
        );
      });
    });
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1 px-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        {typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-4 flex",
        message.isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] space-y-2",
          message.isUser
            ? "bg-primary text-primary-foreground rounded-lg p-4"
            : "bg-muted rounded-lg p-4",
        )}
      >
        {typeof message.content === "string"
          ? renderContent(message.content)
          : JSON.stringify(message.content)}

        {isError && onRetry && (
          <button
            onClick={onRetry}
            className="text-sm underline mt-2 text-destructive hover:text-destructive/80"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
});
