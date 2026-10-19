import { useEffect } from 'react';
import { SITE_ORIGIN } from './structuredData';

interface RouteHeadProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

// index.html ships these for crawlers that never run a script and for the
// frame before mount. Once a route has rendered its own, the static copy is a
// second <title> in the live document, which Bing reports and may index, so it
// goes. Raw HTML keeps it, which is the only place it was ever needed.
// Marking a tag data-default promises that this component renders its
// replacement on every route, and only static index.html tags may carry the
// mark: React removes its own hoisted tags itself and throws if one is gone.
function removeStaticDefaults() {
  for (const el of document.head.querySelectorAll('[data-default]')) el.remove();
}

export function RouteHead({
  title,
  description,
  path,
  noindex = false,
}: RouteHeadProps) {
  const url = `${SITE_ORIGIN}${path}`;
  useEffect(removeStaticDefaults, []);
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {!noindex && <link rel="canonical" href={url} />}
      <meta name="robots" content={noindex ? 'noindex,follow' : 'index,follow'} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </>
  );
}
