// services/websocket.ts
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers = new Map<string, Set<(data: any) => void>>();
  private connectionPromise: Promise<void> | null = null;

  constructor(private baseUrl: string) {
    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.baseUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const handlers = this.messageHandlers.get(data.type);
            if (handlers) {
              handlers.forEach(handler => handler(data));
            }
          } catch (error) {
            // Silent catch - malformed messages shouldn't crash the app
          }
        };

        this.ws.onclose = () => {
          this.connectionPromise = null;
          this.handleReconnect();
        };

        this.ws.onerror = () => {
          this.connectionPromise = null;
          reject(new Error('WebSocket connection failed'));
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyError(new Error('Maximum reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    this.reconnectDelay *= 1.5; // Exponential backoff

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
    this.connect();
  }

  private notifyError(error: Error) {
    const errorHandlers = this.messageHandlers.get('error');
    if (errorHandlers) {
      errorHandlers.forEach(handler => handler(error));
    }
  }

  public async sendMessage(content: string): Promise<void> {
    try {
      await this.connect();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'chat',
          content
        }));
      }
    } catch (error) {
      this.notifyError(error as Error);
    }
  }

  public onMessage(type: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  public close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connectionPromise = null;
    }
  }
}

// Create singleton instance
export const websocketService = new WebSocketService(
  `ws://${process.env.NEXT_PUBLIC_WS_HOST || 'localhost:8080'}/ws`
);
