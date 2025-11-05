import * as React from "react"
import { cn } from "@/lib/utils"

interface IconContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "primary" | "secondary" | "success" | "muted"
}

const IconContainer = React.forwardRef<HTMLDivElement, IconContainerProps>(
  ({ className, size = "md", variant = "primary", children, ...props }, ref) => {
    const sizeClasses = {
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-12 h-12",
      xl: "w-16 h-16"
    }

    const variantClasses = {
      primary: "bg-primary/10 border-primary/20",
      secondary: "bg-secondary/10 border-secondary/20",
      success: "bg-success/10 border-success/20",
      muted: "bg-muted border-border"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl flex items-center justify-center border transition-colors",
          sizeClasses[size],
          variantClasses[variant],
          variant === "primary" && "group-hover:bg-primary/15",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

IconContainer.displayName = "IconContainer"

export { IconContainer }
