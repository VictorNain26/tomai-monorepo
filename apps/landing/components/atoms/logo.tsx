import Link from "next/link";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 hover:opacity-90 transition-opacity", className)}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
        <Brain className="h-6 w-6 text-primary" />
      </div>
      <span className="text-xl font-bold text-foreground">TomIA</span>
    </Link>
  );
}
