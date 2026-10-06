import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;

function SheetContent({
  className,
  children,
  ...props
}: Omit<SheetPrimitive.Popup.Props, "className"> & { className?: string | undefined }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay/80" />
      <SheetPrimitive.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-3/4 flex-col gap-4 border-l bg-background shadow-lg sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full opacity-70 transition-opacity duration-base hover:opacity-100">
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">Fermer</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: Omit<SheetPrimitive.Title.Props, "className"> & { className?: string | undefined }) {
  return <SheetPrimitive.Title className={cn("font-bold text-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetContent, SheetTitle };
