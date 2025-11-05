import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles - Hauteur augmentée et meilleur padding
        "h-11 w-full min-w-0 rounded-lg border-2 bg-background px-4 py-2.5 text-sm",
        "placeholder:text-muted-foreground/60",
        "selection:bg-primary selection:text-primary-foreground",

        // Border et hover states
        "border-input transition-all duration-200",
        "hover:border-input/80",

        // Focus state - Plus doux et moderne
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10",

        // États invalides/erreurs
        "aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10",

        // État désactivé
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",

        // File input styling
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",

        className
      )}
      {...props}
    />
  )
}

export { Input }
