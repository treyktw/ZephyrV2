import { useEffect, useRef } from 'react';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

interface StreamingArtifactProps {
  content: string;
  language?: string;
  isStreaming?: boolean;
}

export function StreamingArtifact({ content, language = 'plaintext', isStreaming }: StreamingArtifactProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-md overflow-hidden",
        isStreaming && "animate-pulse"
      )}
    >
      <CodeBlock
        code={content}
        language={language}
        filename="output.txt"
      />
      {isStreaming && (
        <div className="absolute bottom-0 right-0 p-2 text-xs text-muted-foreground bg-background/80">
          Streaming...
        </div>
      )}
    </div>
  );
}
