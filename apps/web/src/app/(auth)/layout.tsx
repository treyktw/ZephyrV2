'use client'

// app/(auth)/layout.tsx
import { PropsWithChildren } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const logoVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.2 }
  }
};

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <AnimatePresence>
      <motion.div
        className="min-h-screen w-full bg-background flex flex-col"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Header with Logo */}
        <header className="w-full p-6 border-b border-border/5">
          <div className="max-w-md mx-auto">
            <Link href="/">
              <motion.div
                className="flex items-center space-x-2"
                variants={logoVariants}
              >
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  ZephyrV2
                </h1>
              </motion.div>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div
            className="w-full max-w-md mx-auto"
            variants={contentVariants}
          >
            {children}
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="w-full p-6 border-t border-border/5">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ZephyrV2. All rights reserved.
            </p>
            <div className="flex items-center space-x-4">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms
              </Link>
            </div>
          </div>
        </footer>

        {/* Background Pattern - Optional */}
        <div className="fixed inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
      </motion.div>
    </AnimatePresence>
  );
}
