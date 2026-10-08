import Markdown, { type Options } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// KaTeX's HTML output sets style attributes, which the CSP refuses: MathML needs none, and every
// phone browser draws it. The prompt asks Tom for $…$ inline.
const remarkPlugins: Options['remarkPlugins'] = [remarkMath];
const rehypePlugins: Options['rehypePlugins'] = [[rehypeKatex, { output: 'mathml' }]];

/**
 * What Tom writes, as the student reads it: formatting and formulas. Neither HTML, nor a link, nor
 * an image the model wrote: a child has no link from an AI to follow.
 */
export function TomText({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} skipHtml disallowedElements={['a', 'img']} unwrapDisallowed>
        {children}
      </Markdown>
    </div>
  );
}
