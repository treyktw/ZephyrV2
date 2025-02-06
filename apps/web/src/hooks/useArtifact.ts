// hooks/useArtifact.ts
import { create } from 'zustand';

interface ArtifactContent {
  id: string;
  content: string | React.ReactNode;
  type: 'code' | 'text';
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  streaming?: boolean;
}

interface ArtifactStore {
  artifacts: ArtifactContent[];
  currentArtifact: ArtifactContent | null;
  isOpen: boolean;

  // Core artifact management
  openArtifact: (artifact: ArtifactContent) => void;
  closeArtifact: () => void;
  addArtifact: (artifact: ArtifactContent) => void;
  removeArtifact: (id: string) => void;

  // New update functions
  updateArtifact: (id: string, updates: Partial<Omit<ArtifactContent, 'id'>>) => void;
  updateArtifactContent: (id: string, content: string | React.ReactNode) => void;
}

export const useArtifact = create<ArtifactStore>((set, get) => ({
  artifacts: [],
  currentArtifact: null,
  isOpen: false,

  openArtifact: (artifact) => {
    // When opening an artifact, we update both the current artifact and open state
    set({
      currentArtifact: artifact,
      isOpen: true
    });
  },

  closeArtifact: () => {
    // When closing, we clear the current artifact and close the panel
    set({
      currentArtifact: null,
      isOpen: false
    });
  },

  addArtifact: (artifact) => {
    set((state) => ({
      artifacts: [...state.artifacts, artifact],
      // Optionally open the artifact when it's added
      currentArtifact: artifact,
      isOpen: true
    }));
  },

  removeArtifact: (id) => {
    set((state) => {
      // If we're removing the current artifact, close the panel
      if (state.currentArtifact?.id === id) {
        return {
          artifacts: state.artifacts.filter(a => a.id !== id),
          currentArtifact: null,
          isOpen: false
        };
      }
      return {
        artifacts: state.artifacts.filter(a => a.id !== id)
      };
    });
  },

  updateArtifact: (id, updates) => {
    set((state) => {
      // Find the artifact we want to update
      const artifactIndex = state.artifacts.findIndex(a => a.id === id);
      if (artifactIndex === -1) return state;

      // Create the updated artifact
      const updatedArtifact = {
        ...state.artifacts[artifactIndex],
        ...updates
      };

      // Create new artifacts array with the update
      const newArtifacts = [...state.artifacts];
      newArtifacts[artifactIndex] = updatedArtifact;

      // If this is the current artifact, update that too
      if (state.currentArtifact?.id === id) {
        return {
          artifacts: newArtifacts,
          currentArtifact: updatedArtifact
        };
      }

      return { artifacts: newArtifacts };
    });
  },

  updateArtifactContent: (id, content) => {
    // This is a convenience function that uses updateArtifact
    // specifically for updating content
    get().updateArtifact(id, { content });
  },
}));
