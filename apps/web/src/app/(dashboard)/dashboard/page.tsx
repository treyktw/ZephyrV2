"use client";

import React from "react";

import { motion } from "framer-motion";
import { Spotlight } from "@/components/ui/spotlight-new";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { createChat } from "@/lib/actions/chat";
import { useRouter } from "next/navigation";

export default function DashboardMain() {
  const router = useRouter();

  const handleNewChat = async (message: string) => {
    try {
      // Create new chat and get its ID
      const chatId = await createChat(message);
      // Redirect to the chat page (will be smooth because of Next.js)
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Spotlight Effect */}
      <Spotlight
        gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(270, 100%, 85%, .08) 0, hsla(270, 100%, 55%, .02) 50%, hsla(270, 100%, 45%, 0) 80%)"
        gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(270, 100%, 85%, .06) 0, hsla(270, 100%, 55%, .02) 80%, transparent 100%)"
        gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(270, 100%, 85%, .04) 0, hsla(270, 100%, 45%, .02) 80%, transparent 100%)"
      />

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="max-w-4xl w-full space-y-8">
          {/* Welcome Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
              What would you like to learn?
            </h1>
            <p className="text-muted-foreground">
              Ask me anything - I&apos;ll adapt to help you best
            </p>
          </motion.div>

          {/* Main Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PlaceholdersAndVanishInput
              placeholders={[
                "Ask me anything...",
                "Help me solve this equation...",
                "Explain this code snippet...",
                "Analyze this document...",
              ]}
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input");
                if (input?.value) {
                  handleNewChat(input.value);
                }
              }}
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
