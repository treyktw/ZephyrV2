// hooks/useChatMessages.ts
import { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types/chat.types';
import { db } from '@/db/dexie';

export function useChatMessages(chatId: string, initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('Setting initial messages:', initialMessages);
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
      setIsLoading(false);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (initialMessages.length === 0) {
      const fetchMessages = async () => {
        try {
          const response = await fetch(`/api/chat?chatId=${chatId}`);
          if (!response.ok) throw new Error('Failed to fetch messages');

          const data = await response.json();
          setMessages(data);
        } catch (err) {
          console.error('Error fetching messages:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
        } finally {
          setIsLoading(false);
        }
      };

      fetchMessages();
    }
  }, [chatId, initialMessages.length]);

  // Initialize with provided messages
  useEffect(() => {
    const initializeMessages = async () => {
      try {
        // Sort initial messages by creation date

        const sortedMessages = [...initialMessages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Store initial messages in local DB
        await db.messages.bulkPut(sortedMessages);
        setMessages(sortedMessages);
      } catch (err) {
        console.error('Error initializing messages:', err);
      }
    };

    if (initialMessages.length > 0) {
      initializeMessages();
    }
  }, [initialMessages]);

  // Fetch all messages from server and local DB
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  const addMessage = useCallback(async (message: Message) => {
    try {
      // Add to local state immediately
      setMessages(prev => [...prev, message]);

      // Save to server
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) throw new Error('Failed to save message');

    } catch (err) {
      console.error('Error adding message:', err);
      // Remove from local state if server save failed
      setMessages(prev => prev.filter(m => m.id !== message.id));
    }
  }, [chatId]);


  const updateMessage = useCallback(async (messageId: string, content: string) => {
    try {
      // Update local state
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content, updatedAt: new Date() }
            : msg
        )
      );

      // Update local DB
      await db.messages.update(messageId, (message) => {
        message.content = content;
      });

      // Update server
      await fetch(`/api/chats/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch (err) {
      console.error('Error updating message:', err);
    }
  }, []);

  // Initial fetch if no initial messages
  useEffect(() => {
    if (initialMessages.length === 0) {
      fetchMessages();
    }
  }, [fetchMessages, initialMessages.length]);

  return {
    messages,
    isLoading,
    error,
    addMessage,
    updateMessage,
    refetch: fetchMessages
  };
}
