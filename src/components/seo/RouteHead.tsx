const SITE_ORIGIN = 'https://dice-table.app';

interface RouteHeadProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

export function RouteHead({
  title,
  description,
  path,
  noindex = false,
}: RouteHeadProps) {
  const url = `${SITE_ORIGIN}${path}`;
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
