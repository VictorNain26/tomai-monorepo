import { cn } from "@repo/ui";

interface NotebookSheetProps {
  band?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function NotebookSheet({ band = false, className, children }: NotebookSheetProps) {
  return (
    <div data-sheet="" data-band={band ? "" : undefined} className={cn("sheet", className)}>
      <div aria-hidden="true" data-sheet-rules="" className={cn("sheet-rules", band && "top-(--band)")} />
      <div aria-hidden="true" data-sheet-verticals="" className="sheet-verticals" />
      <div aria-hidden="true" data-sheet-margin="" className="sheet-margin" />
      {children}
    </div>
  );
}
