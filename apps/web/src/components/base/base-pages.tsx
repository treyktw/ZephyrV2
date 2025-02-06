'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Search } from 'lucide-react';
import Link from 'next/link';

// Loading Page Component
export const LoadingPage = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 100));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block"
        >
          <Loader2 className="w-12 h-12 text-accent" />
        </motion.div>

        <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <p className="text-muted-foreground text-sm">
          Loading awesome things...
        </p>
      </motion.div>
    </div>
  );
};

// Error Page Component
export const ErrorPage = ({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tighter">
            Oops! Something went wrong
          </h1>
          <p className="text-muted-foreground">
            {error.message || "An unexpected error occurred"}
          </p>
        </div>

        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-background bg-accent hover:bg-accent/90 animate-glow"
        >
          Try Again
        </button>
      </motion.div>
    </div>
  );
};

// Not Found Page Component
export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <div className="relative">
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="relative z-10"
          >
            <Search className="w-20 h-20 text-accent mx-auto" />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-accent/20 blur-xl rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tighter">
            404
          </h1>
          <p className="text-xl font-semibold">
            Page Not Found
          </p>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-background bg-accent hover:bg-accent/90 animate-glow"
        >
          Return Home
        </Link>
      </motion.div>
    </div>
  );
};

const pages = {
  LoadingPage,
  ErrorPage,
  NotFoundPage
};

export default pages;
