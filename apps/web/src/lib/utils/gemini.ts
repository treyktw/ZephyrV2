// lib/services/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // async generateResponse(message: string): Promise<string> {
  //   const model = this.genAI.getGenerativeModel({
  //     model: "gemini-2.0-flash",
  //     generationConfig: {
  //       temperature: 1,
  //       topP: 0.95,
  //       topK: 40,
  //       maxOutputTokens: 8192,
  //       responseMimeType: "text/plain",
  //     },
  //   });

  //   const result = await model.generateContent(message);
  //   const response = await result.response;
  //   return response.text();
  // }

  async streamResponse(
    chatId: string,
    message: string,
    onToken: (token: string) => Promise<void>,
  ): Promise<void> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain",
        },
      });

      const result = await model.generateContentStream(message);
      let buffer = "";

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          // Split the text into words and process each
          const words = text.split(/(\s+)/);
          for (const word of words) {
            buffer += word;
            // Send buffer when we have a complete word or punctuation
            if (word.match(/[\s.!?,]/)) {
              await onToken(buffer);
              buffer = "";
            }
          }
        }
      }

      // Send any remaining buffer
      if (buffer) {
        await onToken(buffer);
      }
    } catch (error) {
      console.error("Gemini streaming error:", error);
      throw error;
    }
  }
}

const geminiService = new GeminiService(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
);
export default geminiService;
