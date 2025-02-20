// lib/services/phoenix-socket.ts
import { Socket, Channel } from "phoenix";

class PhoenixSocketService {
  private socket: Socket;
  private channel: Channel | null = null;

  constructor() {
    console.log("🔷 Initializing Phoenix Socket Service");
    this.socket = new Socket("http://localhost:4000/socket");
  }

  connect() {
    console.log("🔷 Connecting to Phoenix socket");
    this.socket.connect();

    this.socket.onOpen(() => {
      console.log("🔷 Socket connection opened");
    });

    this.socket.onError(() => {
      console.error("🔴 Socket connection error");
    });

    this.socket.onClose(() => {
      console.log("🔷 Socket connection closed");
    });
  }

  joinChat(chatId: string) {
    console.log(`🔷 Joining chat channel: ${chatId}`);
    this.channel = this.socket.channel(`chat:${chatId}`);

    this.channel.join()
      .receive("ok", resp => {
        console.log("🟢 Joined chat successfully", resp);
      })
      .receive("error", resp => {
        console.error("🔴 Failed to join chat", resp);
      });

    this.channel.onError(e => {
      console.error("🔴 Channel error:", e);
    });

    return this.channel;
  }

  sendMessage(content: string) {
    console.log(`🔷 Sending message: ${content}`);
    return new Promise((resolve, reject) => {
      if (!this.channel) {
        console.error("🔴 No channel joined");
        reject("No channel joined");
        return;
      }

      this.channel.push("new_message", { content })
        .receive("ok", response => {
          console.log("🟢 Message sent successfully:", response);
          resolve(response);
        })
        .receive("error", error => {
          console.error("🔴 Failed to send message:", error);
          reject(error);
        });
    });
  }
}

export const phoenixSocket = new PhoenixSocketService();
