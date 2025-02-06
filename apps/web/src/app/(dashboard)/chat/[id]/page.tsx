// app/(dashboard)/chat/[id]/page.tsx
import { Metadata } from 'next';
import { fetchChat } from '@/lib/actions/chat';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Message } from '@/types/chat.types';
import { Loader2 } from 'lucide-react';
import { ChatContainer } from '@/components/chat/Container';

interface ChatPageProps {
  params: { id: string };
}

export async function generateMetadata(): Promise<Metadata> {
  // const chat = await fetchChat(params.id);

  return {
    title: 'Chat',
    description: 'ZephyrV2 Chat'
  };
}

const ChatPage = async({ params }: ChatPageProps) => {
  const { id } = await params; // Destructure id from params
  const chat = await fetchChat(id);

  if (!chat) notFound();

  // Transform messages to ensure proper typing
  const messages = chat.messages.map(msg => ({
    ...msg,
    isUser: Boolean(msg.isUser),
    type: msg.type || 'text',
    metadata: msg.metaData || {}
  })) as Message[];

  return (
    <div className="h-screen max-w-4xl mx-auto">
      <Suspense fallback={
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }>
        <ChatContainer
          chatId={id}
          initialMessages={messages}
        />
      </Suspense>
    </div>
  );
}

export default ChatPage;
