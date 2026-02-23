export function BackgroundPattern() {
  return (
    <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden">
      <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[380px] w-[380px] rounded-full bg-violet/15 blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[120px]" />
    </div>
  );
}
