// ChatContainer.tsx
"use client";

import { useState, useCallback } from "react";
import { Message } from "@/types/chat.types";
import { ChatInput } from "./Input";
import { ChatMessage } from "./Message";
import { model } from "@/lib/ai/providers/gemini";

interface ChatContainerProps {
  chatId: string;
  initialMessages: Message[];
}

export function ChatContainer({ chatId, initialMessages }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = useCallback(async (content: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      chatId,
      content,
      type: "text",
      isUser: true,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Create assistant message
    const assistantMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      chatId,
      content: "",
      type: "text",
      isUser: false,
      createdAt: new Date(),
      streaming: true
    }]);

    try {
      // Generate streaming response
      const result = await model.generateContentStream(content);
      let accumulatedContent = "";

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        accumulatedContent += chunkText;

        // Update message with new content
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedContent }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "Sorry, there was an error generating the response.",
                type: "error",
                streaming: false
              }
            : msg
        )
      );
    } finally {
      // Mark streaming as complete
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, streaming: false }
            : msg
        )
      );
      setIsProcessing(false);
    }
  }, [chatId, isProcessing]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={message.streaming}
          />
        ))}
      </div>

      <ChatInput
        onSubmit={handleSubmit}
        isLoading={isProcessing}
      />
    </div>
  );
}
