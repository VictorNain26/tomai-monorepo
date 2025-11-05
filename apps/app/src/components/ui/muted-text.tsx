import * as React from "react"
import { cn } from "@/lib/utils"

interface MutedTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  size?: "xs" | "sm" | "base"
}

const MutedText = React.forwardRef<HTMLParagraphElement, MutedTextProps>(
  ({ className, size = "sm", ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          "text-muted-foreground",
          size === "xs" && "text-xs",
          size === "sm" && "text-sm",
          size === "base" && "text-base",
          className
        )}
        {...props}
      />
    )
  }
)

MutedText.displayName = "MutedText"

export { MutedText }
