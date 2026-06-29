import { Loader2 } from "lucide-react";

export function ChatStatus({ status }: { status: string }) {
  if (!status) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground"
    >
      <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
      {status}
    </div>
  );
}
