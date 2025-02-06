"use client";

// components/chat/Container.tsx
import { useState, useCallback, useRef } from "react";
import { Message } from "@/types/chat.types";
import { nanoid } from "nanoid";
import { llmClient } from "@/lib/llm/client";
import { saveMessage } from "@/lib/actions/chat";
import { ChatInput } from "./Input";
import { ChatMessage } from "./Message";
import { OutputFormatter } from "@/lib/ai/outputFormatter";

interface ChatContainerProps {
  chatId: string;
  initialMessages: Message[];
}

export function ChatContainer({ chatId, initialMessages }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [streamingId, setStreamingId] = useState<string | null>(null);

  // Use refs to track message processing status
  const processingMessageRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | number | null>(null);

  const updateStreamingMessage = useCallback(
    (newContent: string) => {
      setStreamingMessage((prev) => prev + newContent);

      // Reset timeout for AI response
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: nanoid(),
            chatId,
            content: "AI response timeout. Please try again.",
            type: "error",
            isUser: false,
            createdAt: new Date(),
          },
        ]);
        setIsProcessing(false);
        setStreamingId(null);
        setStreamingMessage("");
      }, 30000); // 30 second timeout
    },
    [chatId],
  );

  const processMessage = useCallback(
    async (content: string, messageId: string) => {
      // Prevent duplicate processing
      if (processingMessageRef.current === content) {
        return;
      }

      processingMessageRef.current = content;
      setIsProcessing(true);
      setStreamingId(messageId);
      setStreamingMessage("");

      try {
        let fullResponse = "";
        let hasStartedResponse = false;

        // Start streaming response
        await llmClient.chat(content, (token) => {
          console.log('Pre-format token:', token);
          hasStartedResponse = true;
          updateStreamingMessage(token);
          fullResponse += token;
          console.log('Post-format content:', fullResponse);
          setMessages((prev) => {
            const updatedMessages = [...prev];
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (lastMessage && !lastMessage.isUser) {
              // Add logging to see message updates
              console.log('Previous content:', lastMessage.content);
              console.log('New content:', token);
              lastMessage.content = token;
            }
            return updatedMessages;
          });
        });

        // Verify we got a meaningful response
        if (!hasStartedResponse || !fullResponse.trim()) {
          throw new Error("No response received from AI");
        }

        // After streaming is complete, save the AI message
        const aiMessage: Message = {
          id: messageId,
          chatId,
          content: fullResponse,
          type: "text",
          isUser: false,
          createdAt: new Date(),
        };

        // Save AI message to DB
        await saveMessage(chatId, fullResponse, "text", {
          isUser: false,
          isAI: true,
        });

        // Update messages with final AI response
        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        console.error("Error processing message:", error);

        // Add appropriate error message based on error type
        const errorMessage: Message = {
          id: nanoid(),
          chatId,
          content:
            error instanceof Error &&
            error.message === "No response received from AI"
              ? "AI did not generate a response. Please try again."
              : "Failed to get response. Please check your connection and try again.",
          type: "error",
          isUser: false,
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        // Clean up
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setIsProcessing(false);
        setStreamingId(null);
        setStreamingMessage("");
        processingMessageRef.current = null;
      }
    },
    [chatId, updateStreamingMessage],
  );

  // Combined handler for both initial and subsequent messages
  const handleSubmit = useCallback(
    async (content: string) => {
      if (isProcessing || !content.trim()) return;
      setIsProcessing(true);

      try {
        // Create and display user message
        const userMessage: Message = {
          id: nanoid(),
          chatId,
          content,
          type: "text",
          isUser: true,
          createdAt: new Date(),
        };

        await saveMessage(chatId, content, "text", {
          isUser: true,
          timestamp: new Date().toISOString(),
        });

        setMessages((prev) => [...prev, userMessage]);

        // Create AI message placeholder
        const aiMessageId = nanoid();
        const aiMessage: Message = {
          id: aiMessageId,
          chatId,
          content: "",
          type: "text",
          isUser: false,
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Initialize formatter for handling AI response
        const formatter = new OutputFormatter();
        let formattedContent = '';

        await llmClient.chat(content, (token) => {
          // Process each token through our formatter
          const { displayContent } = formatter.processToken(token);
          formattedContent = displayContent;

          // Update message with properly formatted content
          setMessages((prev) => {
            const updatedMessages = [...prev];
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (lastMessage && !lastMessage.isUser) {
              lastMessage.content = formattedContent;
            }
            return updatedMessages;
          });
        });

        // Finalize the response
        formatter.finalize();

        // Save the final message
        await saveMessage(chatId, formattedContent, "text", {
          isUser: false,
          isAI: true,
          timestamp: new Date().toISOString(),
          metadata: {
            artifactIds: formatter.getArtifactIds(),
          },
        });

      } catch (error) {
        console.error("Error processing message:", error);

        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            id: nanoid(),
            chatId,
            content: "Failed to get response. Please try again.",
            type: "error",
            isUser: false,
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [chatId, isProcessing],
  );

  // Handle initial message if needed
  if (
    messages.length === 1 &&
    messages[0].isUser &&
    !isProcessing &&
    !processingMessageRef.current
  ) {
    const initialMessage = messages[0];
    processMessage(String(initialMessage.content), nanoid());
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {streamingId && (
          <div className="flex justify-start mb-4">
            <div className="bg-muted rounded-lg p-4 max-w-[80%]">
              {streamingMessage || "Thinking..."}
            </div>
          </div>
        )}
      </div>

      <ChatInput onSubmit={handleSubmit} isLoading={isProcessing} />
    </div>
  );
}
