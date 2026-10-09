import { memo } from 'react';
import Markdown, { type Components, type Options } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { mathDelimited } from '../lib/chat';
import { unreadableMathAsText } from '../lib/math';

// MathML needs neither KaTeX's stylesheet nor its fonts, and every phone browser draws it; a wide
// formula scrolls on its own, as a formula does not wrap; a fraction in the text keeps the size
// of one on its own line, for a 6e pupil.
const remarkPlugins: Options['remarkPlugins'] = [remarkMath, unreadableMathAsText];
const rehypePlugins: Options['rehypePlugins'] = [[rehypeKatex, { output: 'mathml' }]];

// Tailwind's preflight strips list markers; a single line break of Tom's stays one.
const components: Components = {
  p: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-6">{children}</ol>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-6">{children}</ul>,
  pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
};

/**
 * What Tom writes, as the student reads it: formatting and formulas. Neither HTML, nor a link, nor
 * an image the model wrote: a child has no link from an AI to follow.
 */
export const TomText = memo(function TomText({ children }: { children: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 [&_math]:[math-style:normal] [&_.katex]:inline-block [&_.katex]:max-w-full [&_.katex]:overflow-x-auto [&_.katex]:align-bottom">
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        skipHtml
        disallowedElements={['a', 'img']}
        unwrapDisallowed
      >
        {mathDelimited(children)}
      </Markdown>
    </div>
  );
});
