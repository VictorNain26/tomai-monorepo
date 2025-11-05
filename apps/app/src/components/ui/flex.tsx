import * as React from "react"
import { cn } from "@/lib/utils"

interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: "1" | "2" | "3" | "4" | "6" | "8"
  align?: "start" | "center" | "end"
  justify?: "start" | "center" | "end" | "between"
  direction?: "row" | "col"
}

const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  ({ className, gap = "2", align = "center", justify = "start", direction = "row", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          direction === "col" ? "flex-col" : "flex-row",
          `items-${align}`,
          justify !== "start" && `justify-${justify}`,
          `gap-${gap}`,
          className
        )}
        {...props}
      />
    )
  }
)

Flex.displayName = "Flex"

export { Flex }
