import { describe, expect, it } from 'vitest';
import type { DicePart } from '../../types';
import { validatePart } from './validatePart';
import { singleDieDistribution } from '../../engine/die';

const part = (overrides: Partial<DicePart>): DicePart => ({
  id: 'p',
  count: 1,
  sides: 6,
  ...overrides,
});

describe('validatePart — a chain that could never stop', () => {
  it('refuses a die whose every face explodes', () => {
    const all = part({ explode: { onFaces: [1, 2, 3, 4, 5, 6], depthCap: 3 } });
    expect(validatePart(all).explodeFaces).toBe('Cannot explode on all faces');
  });

  // Counting the picked faces against the die's size answers a different
  // question. These three pick as many faces as the die has and none of them
  // explodes any more often for it.
  it.each([
    ['the same face picked six times', [1, 1, 1, 1, 1, 1]],
    ['faces the die does not have', [7, 8, 9, 10, 11, 12]],
    ['a mix of real and unreachable faces', [6, 7, 8, 9, 10, 11]],
  ])('allows %s', (_label, onFaces) => {
    const p = part({ explode: { onFaces, depthCap: 3 } });
    expect(validatePart(p).explodeFaces).toBeUndefined();
    expect(singleDieDistribution(p).size).toBeGreaterThan(0);
  });

  it('refuses a chain that only every face surviving a reroll can stop', () => {
    // Rerolling 1 to 3 away leaves 4, 5 and 6, and all three explode, so the
    // roll has no ending. The engine answers this with a blank row, and the
    // count-the-faces check passed it because three is fewer than six.
    const p = part({
      reroll: { values: [1, 2, 3], mode: 'always' },
      explode: { onFaces: [4, 5, 6], depthCap: 3 },
    });
    expect(singleDieDistribution(p).size).toBe(0);
    expect(validatePart(p).explodeFaces).toBe('Cannot explode on all faces');
  });

  it('allows the same rule when the reroll only fires once', () => {
    // Rerolling once leaves 1 to 3 reachable, so the chain can still stop.
    const p = part({
      reroll: { values: [1, 2, 3], mode: 'once' },
      explode: { onFaces: [4, 5, 6], depthCap: 3 },
    });
    expect(validatePart(p).explodeFaces).toBeUndefined();
    expect(singleDieDistribution(p).size).toBeGreaterThan(0);
  });

  it('still asks for at least one face', () => {
    expect(validatePart(part({ explode: { onFaces: [], depthCap: 3 } })).explodeFaces).toBe(
      'Pick at least one face',
    );
  });
});
