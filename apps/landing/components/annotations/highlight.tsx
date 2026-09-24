export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-xs bg-highlight px-1 text-foreground">{children}</span>
  );
}
