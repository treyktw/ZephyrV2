// components/chat/ViewCode.tsx
import { Button } from '@/components/ui/button';
import { Code2 } from 'lucide-react';
import { useArtifact } from '@/hooks/useArtifact';

interface ViewCodeProps {
  id: string;
}

export function ViewCode({ id }: ViewCodeProps) {
  const { artifacts, openArtifact } = useArtifact();

  const handleClick = () => {
    const artifact = artifacts.find(a => a.id === id);
    if (artifact) {
      openArtifact(artifact);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleClick}
    >
      <Code2 className="h-4 w-4" />
      View Code Example
    </Button>
  );
}
