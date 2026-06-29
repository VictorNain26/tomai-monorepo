import { cn } from "@repo/ui";
import type { ChatMessage } from "@/lib/hooks/use-chat";
import { MessageContent } from "./message-content";

export function ChatMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] break-words rounded-lg px-4 py-2",
          isUser
            ? "whitespace-pre-wrap text-sm bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? message.content : <MessageContent content={message.content} />}
      </div>
    </div>
  );
}
