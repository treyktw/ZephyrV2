"use client";

import { memo } from "react";
import { Message } from "@/types/chat.types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: () => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming,
  onRetry,
}: ChatMessageProps) {
  const isError = message.type === "error";
  const isLoading = message.type === "loading";
  const isAI = !message.isUser;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1 px-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        {typeof message.content === "string"
          ? message.content
          : "Processing..."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-4 flex",
        message.isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg p-4",
          message.isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          isStreaming && "relative after:absolute after:inline after:content-['▊'] after:animate-pulse after:-right-1"
        )}
      >
        {isAI ? (
          <ReactMarkdown
            className="prose prose-sm dark:prose-invert max-w-none"
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                if (!inline && language) {
                  return (
                    <div className="relative my-4">
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
                  <code className={cn(
                    "bg-muted/50 rounded px-1 py-0.5",
                    className
                  )} {...props}>
                    {children}
                  </code>
                );
              },
              p: ({ children }) => (
                <p className="mb-4 last:mb-0 leading-7">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-4 list-disc pl-4 space-y-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-4 list-decimal pl-4 space-y-2">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="leading-7">{children}</li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary pl-4 italic my-4">
                  {children}
                </blockquote>
              ),
            }}
          >
            {message.content as string}
          </ReactMarkdown>
        ) : (
          <div className="prose prose-sm dark:prose-invert">
            {message.content as string}
          </div>
        )}

        {isError && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-destructive hover:text-destructive/80 underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
});

export default ChatMessage
