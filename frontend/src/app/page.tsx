'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Chat } from '@/components/Chat';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Chat with Ollama</h1>
        <ThemeToggle />
      </div>

      <Chat />
    </main>
  );
}
