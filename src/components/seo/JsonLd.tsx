interface JsonLdProps {
  data: object;
}

// Rendered as a text child (not dangerouslySetInnerHTML, which this project
// forbids). Escaping every '<' as < keeps a stray '</script>' inside a
// string value from ever terminating the block if the HTML is serialized.
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json">{json}</script>;
}
