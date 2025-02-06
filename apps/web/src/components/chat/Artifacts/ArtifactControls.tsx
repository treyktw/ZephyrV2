// components/artifacts/ArtifactControls.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useArtifact } from '@/hooks/useArtifact';
import { Maximize2, Minimize2, X, Minimize } from 'lucide-react';

export function ArtifactControls({ }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { currentArtifact, closeArtifact } = useArtifact();

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
    setIsFullscreen(false);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setIsMinimized(false);
  };

  if (!currentArtifact) return null;

  // When minimized, show only a small button to restore
  if (isMinimized) {
    return (
      <Button
        variant="outline"
        className="fixed bottom-4 right-4 z-50 gap-2"
        onClick={handleMinimize}
      >
        <Maximize2 className="h-4 w-4" />
        <span>Show Code Editor</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMinimize}
        title="Minimize"
      >
        <Minimize className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleFullscreen}
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={closeArtifact}
        title="Close"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
