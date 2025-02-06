'use client'

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  FileText,
  MenuIcon,
  MessageSquare,
  Settings,
  LogOut,
  HelpCircle,
  BookOpen,
  Code,
  PencilRuler,
  User,
  Calculator,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from 'next-auth/react';
import { Chat } from '@/types/chat.types';

interface DashboardSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const router = useRouter();
  const pathname = usePathname();

  const quickLinks = [
    { icon: BookOpen, label: 'Study', href: '/study' },
    { icon: Code, label: 'Code', href: '/code' },
    { icon: Calculator, label: 'Math', href: '/math' },
    { icon: PencilRuler, label: 'Draw', href: '/draw' },
  ];

  const mainLinks = [
    { icon: Calendar, label: 'Calendar', href: '/calendar' },
    { icon: FileText, label: 'Documents', href: '/documents' },
    { icon: MessageSquare, label: 'Chats', href: '/chat' },
  ];

  useEffect(() => {
    const fetchRecentChats = async () => {
      try {
        const response = await fetch('/api/chats?limit=3');
        if (response.ok) {
          const data = await response.json();
          setRecentChats(data);
        }
      } catch (error) {
        console.error('Error fetching recent chats:', error);
      }
    };

    fetchRecentChats();
  }, []);

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-4 py-2 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>ZephyrV2</SheetTitle>
              <SheetClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* Main Content */}
          <ScrollArea className="flex-1 px-4 py-2">
            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {quickLinks.map((link) => (
                <Button
                  key={link.href}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => router.push(link.href)}
                >
                  <link.icon className="h-6 w-6" />
                  {link.label}
                </Button>
              ))}
            </div>

            {/* Main Navigation */}
            <div className="space-y-2 mb-6">
              {mainLinks.map((link) => (
                <Button
                  key={link.href}
                  variant="ghost"
                  className={`w-full justify-start gap-2 ${
                    pathname === link.href ? 'bg-accent' : ''
                  }`}
                  onClick={() => router.push(link.href)}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              ))}
            </div>

            {/* Recent Chats */}
            {recentChats.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground px-2">
                  Recent Chats
                </h2>
                {recentChats.map((chat: Chat) => (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    className="w-full justify-start gap-2 h-auto py-2"
                    onClick={() => router.push(`/chat/${chat.id}`)}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm truncate w-full">{chat.title}</span>
                      {chat.lastMessage && (
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {chat.lastMessage}
                        </span>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* User Menu - Fixed at Bottom */}
          <div className="mt-auto border-t p-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col text-sm">
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => router.push('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/help')}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Help
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => signOut()}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
