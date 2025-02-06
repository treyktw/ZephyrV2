import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeBlock } from '@/components/ui/code-block';
import { Maximize2, Minimize2, Copy, Download } from 'lucide-react';

interface ArtifactViewerProps {
  content: React.ReactNode;
  type: 'code' | 'text';
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export function ArtifactViewer({ content, type, title, metadata }: ArtifactViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof content === 'string') {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (typeof content === 'string') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.${type === 'code' ? metadata?.language || 'txt' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'}`}>
      {/* Artifact header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Artifact content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {type === 'code' ? (
            <CodeBlock
              code={content as string}
              language={metadata?.language || 'plaintext'}
              filename={title}
            />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {content}
            </div>
          )}
        </div>
      </ScrollArea>

      {copied && (
        <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-3 py-2 rounded-md text-sm">
          Copied!
        </div>
      )}
    </div>
  );
}
