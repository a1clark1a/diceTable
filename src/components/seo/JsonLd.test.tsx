import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from './JsonLd';

function scriptText(container: HTMLElement): string {
  const el = container.querySelector('script[type="application/ld+json"]');
  return el?.textContent ?? '';
}

describe('JsonLd', () => {
  it('renders a script tagged as application/ld+json', () => {
    const { container } = render(<JsonLd data={{ a: 1 }} />);
    expect(
      container.querySelector('script[type="application/ld+json"]'),
    ).not.toBeNull();
  });

  it('serializes the data as JSON that parses back to the input', () => {
    const data = { '@type': 'HowTo', steps: [1, 2, 3], nested: { x: 'y' } };
    const { container } = render(<JsonLd data={data} />);
    expect(JSON.parse(scriptText(container))).toEqual(data);
  });

  it('escapes every "<" so a "</script>" in a value cannot close the block', () => {
    const { container } = render(
      <JsonLd data={{ note: 'a </script><b> tag' }} />,
    );
    const raw = scriptText(container);
    expect(raw.includes('<')).toBe(false);
    expect(raw).toContain('\\u003c');
  });

  it('still round-trips a value containing "<" after escaping', () => {
    const data = { note: 'a </script><b> tag & more' };
    const { container } = render(<JsonLd data={data} />);
    expect(JSON.parse(scriptText(container))).toEqual(data);
  });
});
