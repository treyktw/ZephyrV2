export type MessageType =
  | "text"
  | "code"
  | "math"
  | "document"
  | "artifact"
  | "error"
  | "loading"
  | "stream"
  | "table" // Tabular data
  | "image" // Images/diagrams
  | "system"; // System messages;

  export interface Message {
    id: string;
    chatId: string;
    content: string;
    type: MessageType;
    isUser: boolean;
    createdAt: Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
    messages?:  MessageContent;
    streaming?: boolean
  }

export interface MessageContent {
  text: string;
  language?: string; // For code blocks
  format?: string; // For special formatting (e.g., 'latex', 'markdown')
  metadata?: {
    title?: string;
    description?: string;
    rendered?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface Artifact {
  id: string;
  type: "code" | "visualization" | "document";
  content: string;
  language?: string;
  title?: string;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    chatId: string;
    content: string;
    type: string;
    isUser: boolean;
    createdAt: Date;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metaData?: any;
  }>;
  systemPrompt?: string;
  lastMessage: string;

}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface LLMResponse {
  message: {
    content: string;
    role: string;
  };
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
}

export interface AIConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  context?: {
    systemPrompt?: string;
    contextMessages?: Message[];
    tools?: string[];
  };
  outputFormat?: {
    type: MessageType;
    format?: string;
    language?: string;
  };
  systemPrompt?: string;
  metadata?: []
}

// Specific message type helpers
export interface CodeMessage extends Message {
  type: 'code';
  content: MessageContent & {
    language: string;
    filename?: string;
    lineNumbers?: boolean;
  };
}

export interface MathMessage extends Message {
  type: 'math';
  content: MessageContent & {
    format: 'latex' | 'asciimath';
    inline?: boolean;
  };
}

export interface TableMessage extends Message {
  type: 'table';
  content: MessageContent & {
    headers: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: any[][];
  };
}
