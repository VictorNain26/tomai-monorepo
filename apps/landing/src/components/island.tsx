import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';

let hydrated = 0;

// Wraps every React island. Effects run children first, so once each island has run its own, the
// whole page is hydrated: the tests wait on html[data-hydrated].
export function Island({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydrated += 1;
    if (hydrated === document.querySelectorAll('astro-island').length) document.documentElement.dataset['hydrated'] = '';
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
