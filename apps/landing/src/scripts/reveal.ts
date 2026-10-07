import { animate, inView } from 'motion';

// Each [data-reveal] starts in its entry state, set by its component's style only when scripts run: without them, the page shows whole.
const REVEAL_SECONDS = 0.5;
const DRAW_SECONDS = 0.8;
const RISE_PX = 20;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const block of document.querySelectorAll<HTMLElement>('div[data-reveal]')) {
  const delay = Number(block.dataset['delay']);
  inView(
    block,
    () => {
      // Under reduced motion the block still fades in, without moving: Motion's reducedMotion="user".
      animate(block, reducedMotion ? { opacity: [0, 1] } : { opacity: [0, 1], y: [RISE_PX, 0] }, {
        duration: REVEAL_SECONDS,
        delay,
        ease: 'easeOut',
      });
    },
    { margin: '-80px' },
  );
}

for (const stroke of document.querySelectorAll<SVGPathElement>('path[data-reveal]')) {
  if (reducedMotion) continue;
  const delay = Number(stroke.dataset['delay']);
  inView(stroke, () => {
    animate(
      stroke,
      { pathLength: [0, 1] },
      {
        duration: DRAW_SECONDS,
        delay,
        ease: 'easeInOut',
        // The scribble's style hides the stroke until Motion writes its first frame: shown any earlier, it would flash whole.
        onUpdate: () => {
          stroke.dataset['drawing'] = '';
        },
      },
    );
  });
}
