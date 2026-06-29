import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/utils";

export type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root>;

function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };
