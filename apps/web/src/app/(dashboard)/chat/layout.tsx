'use client'

import { useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useArtifact } from '@/hooks/useArtifact';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';
import { ArtifactControls } from '@/components/chat/Artifacts/ArtifactControls';

interface ChatLayoutProps {
  children: React.ReactNode;
}

export default function ChatLayout({ children }: ChatLayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { isOpen: isArtifactOpen, currentArtifact } = useArtifact();

  // This state is now managed by ArtifactControls
  const [isArtifactMinimized, setArtifactMinimized] = useState(false);

  return (
    <div className="h-screen flex">
      {/* Sidebar Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <ResizablePanelGroup direction="horizontal" className="min-h-screen">
        {/* Sidebar Panel */}
        <ResizablePanel
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className={cn(
            "transition-all duration-300 ease-in-out",
            !isSidebarOpen && "hidden"
          )}
        >
          <div className="h-full border-r">
            <ChatSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </ResizablePanel>

        {/* Main Content Panel */}
        <ResizablePanel
          defaultSize={isArtifactOpen && !isArtifactMinimized ? 40 : 80}
          minSize={30}
        >
          {children}
        </ResizablePanel>

        {/* Artifact Panel */}
        {isArtifactOpen && currentArtifact && !isArtifactMinimized && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="h-full flex flex-col border-l">
                {/* Artifact Header with Controls */}
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{currentArtifact.title}</h2>
                    {currentArtifact.metadata?.streaming && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        Streaming...
                      </span>
                    )}
                  </div>
                  {/* We integrate the ArtifactControls here */}
                  <ArtifactControls
                  />
                </div>

                {/* Artifact Content */}
                <ScrollArea className="flex-1 p-4">
                  <CodeBlock
                    code={currentArtifact.content as string}
                    language={currentArtifact.metadata?.language || 'typescript'}
                  />
                </ScrollArea>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Minimized Artifact Button */}
      {isArtifactOpen && isArtifactMinimized && (
        <Button
          variant="outline"
          className="fixed bottom-4 right-4 z-50 gap-2"
          onClick={() => setArtifactMinimized(false)}
        >
          <span>Show Code Editor</span>
        </Button>
      )}
    </div>
  );
}
