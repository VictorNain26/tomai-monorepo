'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'motion/react';
import { cn } from '@repo/ui';
import tom from '@/assets/tom.png';

type Clip = 'still' | 'salut' | 'respiration';

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
  const salutRef = useRef<HTMLVideoElement>(null);
  const respirationRef = useRef<HTMLVideoElement>(null);
  const [clip, setClip] = useState<Clip>('still');

  useEffect(() => {
    // Hidden on small screens, Tom must not download his clips; autoplay can also be refused
    // (iOS Low Power Mode): either way he stays still.
    if (reducedMotion === false && salutRef.current?.checkVisibility()) salutRef.current.play().catch(() => undefined);
  }, [reducedMotion]);

  return (
    <div
      role="img"
      aria-label="Tom, une loutre en pull bleu avec un stylo dans la poche"
      data-testid="tom"
      className={cn('relative aspect-square w-full max-w-sm', className)}
    >
      <Image src={tom} alt="" sizes="176px" className={cn('size-full', clip !== 'still' && 'invisible')} />
      <video
        ref={salutRef}
        aria-hidden="true"
        muted
        playsInline
        preload="none"
        onPlaying={() => {
          setClip('salut');
        }}
        onEnded={() => {
          respirationRef.current?.play().catch(() => undefined);
        }}
        className={cn('absolute inset-0 size-full', clip !== 'salut' && 'invisible')}
      >
        <Sources name="salut" />
      </video>
      <video
        ref={respirationRef}
        aria-hidden="true"
        muted
        playsInline
        loop
        preload="none"
        onPlaying={() => {
          setClip('respiration');
        }}
        className={cn('absolute inset-0 size-full', clip !== 'respiration' && 'invisible')}
      >
        <Sources name="respiration" />
      </video>
    </div>
  );
}
