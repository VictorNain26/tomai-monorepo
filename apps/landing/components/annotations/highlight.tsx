export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <mark className="box-decoration-clone bg-transparent bg-linear-to-t from-highlight from-50% to-transparent to-50% text-foreground">
      {children}
    </mark>
  );
}
