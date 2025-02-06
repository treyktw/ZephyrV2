"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface Chat {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: Date;
}

export function ChatSidebar({ onClose }: { onClose: () => void }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [deleteChat, setDeleteChat] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const currentChatId = pathname.split("/").pop();

  // Fetch chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch('/api/chats');
        if (!response.ok) throw new Error('Failed to fetch chats');
        const data = await response.json();
        setChats(data);

        // If we're on a chat page and there are no chats, redirect to dashboard
        if (data.length === 0 && pathname.startsWith('/chat/')) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };

    fetchChats();
  }, [router, pathname]);

  const createNewChat = async () => {
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to create chat");
      const newChat = await response.json();
      router.push(`/chat/${newChat.id}`);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete chat');

      const remainingChats = chats.filter(chat => chat.id !== chatId);

      // If this was the last chat, redirect to dashboard
      if (remainingChats.length === 0) {
        router.push('/dashboard');
      }
      // If we deleted current chat and there are other chats, go to the first one
      else if (chatId === currentChatId) {
        router.push(`/chat/${remainingChats[0].id}`);
      }

      setChats(remainingChats);
    } catch (error) {
      console.error('Error deleting chat:', error);
    } finally {
      setDeleteChat(null);
    }
  };

  return (
    <div className="w-64 border-r bg-muted/10">
      <div className="p-2">
        <Button
          onClick={createNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-5rem)]">
        <div className="p-2 space-y-2 w-56">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="group relative" // Container for button and dropdown
            >
              <Button
                variant="ghost"
                className={cn(
                  "w-full pr-8", // Space for dropdown button
                  "flex items-center gap-2",
                  chat.id === currentChatId && "bg-accent",
                )}
                onClick={() => router.push(`/chat/${chat.id}`)}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  {" "}
                  {/* Text container with min-w-0 for truncation */}
                  <div className="text-sm font-medium truncate flex">
                    {chat.title}
                  </div>
                  {chat.lastMessage && (
                    <div className="text-xs text-muted-foreground truncate flex">
                      {chat.lastMessage}
                    </div>
                  )}
                </div>
              </Button>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-8 w-8 p-0",
                        "opacity-0 group-hover:opacity-100",
                        "transition-opacity",
                      )}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteChat(chat.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteChat} onOpenChange={() => setDeleteChat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChat && handleDeleteChat(deleteChat)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
