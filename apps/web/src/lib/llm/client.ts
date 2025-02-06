// lib/llm/client.ts
export class LLMClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async chat(
    message: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-coder:6.7b',
          messages: [{ role: 'user', content: message }],
          stream: true
        })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              onToken?.(data.message.content);
              fullResponse += data.message.content;
            }
          } catch (e) {
            console.warn('Failed to parse chunk:', e);
          }
        }
      }

      return fullResponse;
    } catch (error) {
      console.error('LLM Error:', error);
      throw error;
    }
  }
}

export const llmClient = new LLMClient();
