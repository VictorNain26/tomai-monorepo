export function BackgroundPattern() {
  return (
    <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden">
      {/* Grid + red margin in a single masked container */}
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      >
        {/* Cahier quadrillé */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "repeating-linear-gradient(90deg, var(--grid-color) 0px, var(--grid-color) 1px, transparent 1px, transparent 32px)",
              "repeating-linear-gradient(0deg, var(--grid-color) 0px, var(--grid-color) 1px, transparent 1px, transparent 32px)",
            ].join(", "),
          }}
        />

        {/* Marge rouge — signature cahier français */}
        <div className="absolute top-0 bottom-0 left-[64px] w-px bg-red-400/20" />
      </div>

      {/* Subtle color blobs overlay for depth */}
      <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[380px] w-[380px] rounded-full bg-violet/8 blur-[120px]" />
    </div>
  );
}
