/**
 * The math of Tom's text before rehype-katex. KaTeX's error output carries a style attribute,
 * which rehype-katex parses through `template.innerHTML` (hast-util-from-html-isomorphic) and the
 * CSP refuses: a formula KaTeX cannot read goes back to the text it was, never to that path.
 */

import katex from 'katex';

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

const readable = (tex: string, displayMode: boolean) => {
  try {
    katex.renderToString(tex, { displayMode, throwOnError: true, output: 'mathml' });
    return true;
  } catch {
    return false;
  }
};

function check(node: MdNode): MdNode {
  if (node.type === 'inlineMath' && node.value !== undefined && !readable(node.value, false)) return { type: 'text', value: `$${node.value}$` };
  if (node.type === 'math' && node.value !== undefined && !readable(node.value, true)) {
    return { type: 'paragraph', children: [{ type: 'text', value: `$$${node.value}$$` }] };
  }
  if (node.children) node.children = node.children.map(check);
  return node;
}

/** A remark plugin, after remark-math. */
export const unreadableMathAsText = () => (tree: MdNode) => {
  check(tree);
};
