"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/hooks/use-chat";
import { ChatMessage as ChatMessageItem } from "./chat-message";

export function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      role="log"
      aria-label="Conversation"
      className="flex flex-col gap-3 overflow-y-auto px-4 py-4"
    >
      {messages.map((message) => (
        <ChatMessageItem key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
