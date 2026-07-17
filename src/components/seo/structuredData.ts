export interface HowToStepInput {
  title: string;
  plain: string;
}

interface HowToStepLd {
  '@type': 'HowToStep';
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
    step: steps.map((s) => ({
      '@type': 'HowToStep',
      name: s.title,
      text: s.plain,
    })),
  };
}
