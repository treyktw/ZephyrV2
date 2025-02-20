"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface TypeWriterProps {
  content: string;
  className?: string;
  speed?: number;
  onComplete?: () => void;
}

export function TypeWriter({
  content,
  className,
  speed = 100000, // characters per interval
  onComplete
}: TypeWriterProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const contentRef = useRef(content);
  const characterIndexRef = useRef(0);

  useEffect(() => {
    // Reset if content changes
    if (content !== contentRef.current) {
      contentRef.current = content;
      characterIndexRef.current = 0;
      setDisplayedContent("");
      setIsComplete(false);
    }

    // Typing animation
    const interval = setInterval(() => {
      if (characterIndexRef.current < content.length) {
        const nextChar = content[characterIndexRef.current];
        const lookAhead = content.slice(characterIndexRef.current, characterIndexRef.current + 3);

        // Check for markdown tokens to avoid breaking them
        let chunkSize = 1;

        // Handle markdown tokens (don't split them)
        if (lookAhead.startsWith('```') || lookAhead.startsWith('###') ||
            lookAhead.startsWith('##') || lookAhead.startsWith('**')) {
          chunkSize = 3;
        } else if (lookAhead.startsWith('##') || lookAhead.startsWith('**')) {
          chunkSize = 2;
        }

        // Add the next chunk
        setDisplayedContent(prev =>
          prev + content.slice(characterIndexRef.current,
                             characterIndexRef.current + chunkSize)
        );

        characterIndexRef.current += chunkSize;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [content, speed, onComplete]);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (!inline && language) {
              return (
                <div className="relative mt-2">
                  <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    PreTag="div"
                    className="rounded-md !bg-muted/50 !mt-0"
                    showLineNumbers={true}
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code className={cn("bg-muted/50 rounded px-1 py-0.5", className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {!isComplete && <span className="ml-1 animate-pulse">▊</span>}
    </div>
  );
}
