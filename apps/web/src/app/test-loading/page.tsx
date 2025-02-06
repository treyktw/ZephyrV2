// app/preview-loading/page.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LoadingPreview() {
  const [progress, setProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(true);

  // Reset progress and show loading
  const resetLoading = () => {
    setProgress(0);
    setShowLoading(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Controls */}
      <div className="fixed top-4 right-4 space-y-4 bg-card p-4 rounded-lg border border-border">
        <button
          onClick={resetLoading}
          className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 animate-glow"
        >
          Reset Loading
        </button>
        <button
          onClick={() => setShowLoading(!showLoading)}
          className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
        >
          {showLoading ? 'Hide' : 'Show'} Loading
        </button>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Progress</label>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground text-center">
            {progress}%
          </div>
        </div>
      </div>

      {/* Loading Preview */}
      {showLoading && (
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
      )}
    </div>
  );
}
