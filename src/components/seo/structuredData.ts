export const SITE_ORIGIN = 'https://dice-table.app';

export interface HowToStepInput {
  title: string;
  plain: string;
}

interface HowToStepLd {
  '@type': 'HowToStep';
  position: number;
  name: string;
  text: string;
}

export interface HowToLd {
  '@context': 'https://schema.org';
  '@type': 'HowTo';
  name: string;
  description: string;
  step: readonly HowToStepLd[];
}

export function buildHowToLd(
  name: string,
  description: string,
  steps: readonly HowToStepInput[],
): HowToLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    // JSON-LD arrays are unordered sets to strict consumers; position is the
    // schema.org signal that pins the step sequence.
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.title,
      text: s.plain,
    })),
  };
}

export interface DefinedTermInput {
  term: string;
  plain: string;
  details?: string;
  alt?: string;
}

interface DefinedTermLd {
  '@type': 'DefinedTerm';
  name: string;
  description: string;
  alternateName?: string;
  inDefinedTermSet: string;
}

export interface DefinedTermSetLd {
  '@context': 'https://schema.org';
  '@type': 'DefinedTermSet';
  '@id': string;
  name: string;
  description: string;
  hasDefinedTerm: readonly DefinedTermLd[];
}

export function buildDefinedTermSetLd(
  name: string,
  description: string,
  url: string,
  entries: readonly DefinedTermInput[],
): DefinedTermSetLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': url,
    name,
    description,
    hasDefinedTerm: entries.map((e) => ({
      '@type': 'DefinedTerm',
      name: e.term,
      description: e.details ? `${e.plain} ${e.details}` : e.plain,
      // An alt prefixed "e.g." is a display example, not an alias; shipping
      // it as alternateName would be wrong schema.org data.
      ...(e.alt !== undefined && !e.alt.startsWith('e.g.')
        ? { alternateName: e.alt }
        : {}),
      inDefinedTermSet: url,
    })),
  };
}
