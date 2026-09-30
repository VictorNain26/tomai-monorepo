"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import tom from "@/assets/tom.png";

type Clip = "still" | "salut" | "respiration";

function Sources({ name }: { name: string }) {
  return (
    <>
      {/* Safari drops VP9 alpha, so it must meet its HEVC source first. */}
      <source src={`/tom/${name}.mov`} type='video/mp4; codecs="hvc1"' />
      <source src={`/tom/${name}.webm`} type="video/webm" />
    </>
  );
}

export function TomIllustration({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const salut = useRef<HTMLVideoElement>(null);
  const respiration = useRef<HTMLVideoElement>(null);
  const [clip, setClip] = useState<Clip>("still");

  useEffect(() => {
    // Autoplay can be refused (iOS Low Power Mode): Tom then stays still.
    if (reducedMotion === false) salut.current?.play().catch(() => undefined);
  }, [reducedMotion]);

  return (
    <div
      role="img"
      aria-label="Tom, une loutre en pull bleu avec un stylo dans la poche"
      data-testid="tom"
      className={cn("relative aspect-square w-full max-w-sm", className)}
    >
      <Image src={tom} alt="" sizes="384px" preload className={cn("size-full", clip !== "still" && "invisible")} />
      <video
        ref={salut}
        aria-hidden="true"
        muted
        playsInline
        preload="none"
        onPlaying={() => setClip("salut")}
        onEnded={() => respiration.current?.play().catch(() => undefined)}
        className={cn("absolute inset-0 size-full", clip !== "salut" && "invisible")}
      >
        <Sources name="salut" />
      </video>
      <video
        ref={respiration}
        aria-hidden="true"
        muted
        playsInline
        loop
        preload="none"
        onPlaying={() => setClip("respiration")}
        className={cn("absolute inset-0 size-full", clip !== "respiration" && "invisible")}
      >
        <Sources name="respiration" />
      </video>
    </div>
  );
}
