import type { Distribution, KeepRule } from '../types';
import { emptyDistribution, sortedKeys } from '../engine/distribution';

/**
 * Keeping n of `count` identical dice, by enumerating every way they can land.
 *
 * This is the implementation the engine used to ship, kept here as an oracle
 * after the engine moved to a threshold-level dynamic program. The two share no
 * code and no idea: this one walks weak compositions of `count` over the die's
 * distinct faces and weighs each with a multinomial coefficient in log space,
 * while the DP walks thresholds and never enumerates an outcome at all. That is
 * what makes it worth keeping. A test that checks the DP against the DP passes
 * whatever either of them does.
 *
 * It is exponential in the number of distinct faces, so it belongs only in
 * tests, and only on dice small enough to enumerate. That cost is the reason the
 * engine stopped using it: an exploding d6 shows 56 faces, not 6.
 */
export function referenceKeep(
  singleDie: Distribution,
  count: number,
  rule: KeepRule,
): Distribution {
  const n = rule.n;
  if (!Number.isInteger(n) || n < 1 || n > count) return emptyDistribution();

  const faces = sortedKeys(singleDie);
  const probs = faces.map((f) => singleDie.get(f) as number);
  const F = faces.length;
  if (F === 0) return emptyDistribution();

  const logFact: number[] = [0];
  for (let i = 1; i <= count; i++) logFact.push(logFact[i - 1]! + Math.log(i));

  const result = new Map<number, number>();
  const counts: number[] = new Array(F).fill(0);

  function recurse(idx: number, remaining: number): void {
    if (idx === F - 1) {
      counts[idx] = remaining;
      let logProb = logFact[count]!;
      for (let i = 0; i < F; i++) {
        const c = counts[i]!;
        if (c > 0) {
          logProb += c * Math.log(probs[i]!) - logFact[c]!;
        }
      }
      const prob = Math.exp(logProb);

      let kept = 0;
      if (rule.type === 'highest') {
        let toTake = n;
        for (let i = F - 1; i >= 0 && toTake > 0; i--) {
          const take = Math.min(toTake, counts[i]!);
          kept += take * faces[i]!;
          toTake -= take;
        }
      } else {
        let toTake = n;
        for (let i = 0; i < F && toTake > 0; i++) {
          const take = Math.min(toTake, counts[i]!);
          kept += take * faces[i]!;
          toTake -= take;
        }
      }
      result.set(kept, (result.get(kept) ?? 0) + prob);
      return;
    }
    for (let c = 0; c <= remaining; c++) {
      counts[idx] = c;
      recurse(idx + 1, remaining - c);
    }
  }

  recurse(0, count);
  return result;
}
