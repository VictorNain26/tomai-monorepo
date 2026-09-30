import Image from "next/image";
import { cn } from "@repo/ui";
import tomBonjour from "@/assets/tom-bonjour.png";

export function TomIllustration({ className }: { className?: string }) {
  return (
    <Image
      src={tomBonjour}
      alt="Tom, une loutre en pull bleu, fait coucou de la main en souriant"
      sizes="384px"
      preload
      data-testid="tom"
      className={cn("aspect-square h-auto w-full max-w-sm", className)}
    />
  );
}
