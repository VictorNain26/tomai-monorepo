import * as React from "react"
import { cn } from "@/lib/utils"

interface GradientTextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "tomaia" | "primary" | "secondary"
  as?: React.ElementType
}

const GradientText = React.forwardRef<HTMLElement, GradientTextProps>(
  ({ className, variant = "tomaia", as: Component = "span", children, ...props }, ref) => {
    const variantClasses = {
      tomaia: "bg-gradient-to-r from-primary to-secondary",    /* Tom brand gradient - Blue + Green */
      primary: "bg-gradient-to-r from-primary to-primary/80",
      secondary: "bg-gradient-to-r from-secondary to-secondary/80"
    }

    return (
      <Component
        ref={ref}
        className={cn(
          "bg-clip-text text-transparent font-semibold",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

GradientText.displayName = "GradientText"

export { GradientText }
