type ElOpts = {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
};

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOpts = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [key, value] of Object.entries(opts.attrs)) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
};

export const clear = (node: Element): void => {
  node.replaceChildren();
};
