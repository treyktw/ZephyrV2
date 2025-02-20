import { encode } from 'gpt-tokenizer';

interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
  preserveSentences?: boolean;
}

export class TextChunker {
  private static readonly defaultOptions: ChunkOptions = {
    maxTokens: 512,
    overlap: 50,
    preserveSentences: true
  };

  static chunk(text: string, options?: ChunkOptions): string[] {
    const finalOptions = { ...this.defaultOptions, ...options };
    const chunks: string[] = [];

    // First, split into sentences if preserving sentences
    const textPieces = finalOptions.preserveSentences
      ? this.splitIntoSentences(text)
      : [text];

    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const piece of textPieces) {
      const pieceTokens = encode(piece);

      if (currentTokens + pieceTokens.length > finalOptions.maxTokens!) {
        // Save current chunk
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '));
          // Keep some sentences for overlap
          if (finalOptions.overlap! > 0) {
            const overlapTokenCount = encode(currentChunk.join(' ')).length;
            while (currentChunk.length > 0 && overlapTokenCount > finalOptions.overlap!) {
              currentChunk.shift();
            }
          } else {
            currentChunk = [];
          }
          currentTokens = encode(currentChunk.join(' ')).length;
        }
      }

      currentChunk.push(piece);
      currentTokens += pieceTokens.length;
    }

    // Add the last chunk if there's anything left
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  private static splitIntoSentences(text: string): string[] {
    // Basic sentence splitting - can be made more sophisticated
    return text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  static async generateChunkEmbeddings(
    chunks: string[],
    generateEmbedding: (text: string) => Promise<number[]>
  ): Promise<{ chunk: string; embedding: number[]; }[]> {
    return await Promise.all(
      chunks.map(async chunk => ({
        chunk,
        embedding: await generateEmbedding(chunk)
      }))
    );
  }

  static async processTextForEmbeddings(
    text: string,
    options: ChunkOptions,
    generateEmbedding: (text: string) => Promise<number[]>
  ) {
    const chunks = this.chunk(text, options);
    return await this.generateChunkEmbeddings(chunks, generateEmbedding);
  }
}
