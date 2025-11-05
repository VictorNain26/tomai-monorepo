import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-8 w-8",
      lg: "h-12 w-12"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "animate-spin rounded-full border-b-2 border-primary mx-auto",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)

LoadingSpinner.displayName = "LoadingSpinner"

export { LoadingSpinner }
