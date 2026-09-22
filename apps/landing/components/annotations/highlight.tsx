export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="box-decoration-clone rounded-xs bg-highlight px-1 text-foreground">{children}</span>
  );
}
