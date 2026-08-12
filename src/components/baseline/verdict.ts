import { formatNumber } from '../chart/format';

// Verdict thresholds are looser than the delta-cell eps on purpose: the
// sentence rounds harder than the numbers, so it only calls out differences
// big enough to survive its own rounding.
const AVG_EPS = 0.005;
const SIGMA_EPS = 0.05;
const HIT_EPS_POINTS = 0.5;

export interface VerdictInput {
  mean: number;
  stddev: number;
  isPool: boolean;
  /** First Hit % value (pool rows: the pool-target hit); null when no targets are set. */
  firstHit: number | null;
  baseMean: number;
  baseStddev: number;
  baseIsPool: boolean;
  baseFirstHit: number | null;
}

function hitPhrase(deltaPoints: number): string {
  if (Math.abs(deltaPoints) < HIT_EPS_POINTS) return 'hits about as often';
  const direction = deltaPoints > 0 ? 'more' : 'less';
  return `hits ${Math.abs(deltaPoints).toFixed(0)}% ${direction} often`;
}

export function buildVerdict(input: VerdictInput): string {
  const sameScale = input.isPool === input.baseIsPool;
  const hitDelta =
    input.firstHit !== null && input.baseFirstHit !== null
      ? (input.firstHit - input.baseFirstHit) * 100
      : null;

  if (!sameScale) {
    if (hitDelta !== null) return `Different scale, but ${hitPhrase(hitDelta)}`;
    return input.isPool
      ? 'Counts successes, so totals aren’t comparable to the baseline'
      : 'The baseline counts successes, so totals aren’t comparable';
  }

  const parts: string[] = [];
  const meanDelta = input.mean - input.baseMean;
  const unit = input.isPool ? ' successes' : '';
  parts.push(
    Math.abs(meanDelta) < AVG_EPS
      ? 'same average'
      : `averages ${formatNumber(Math.abs(meanDelta), 1)}${unit} ${
          meanDelta > 0 ? 'higher' : 'lower'
        }`,
  );
  const sigmaDelta = input.stddev - input.baseStddev;
  if (Math.abs(sigmaDelta) >= SIGMA_EPS) {
    parts.push(sigmaDelta > 0 ? 'swingier' : 'steadier');
  }
  if (hitDelta !== null) parts.push(hitPhrase(hitDelta));

  const sentence = parts.join(' · ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
