import type { Distribution, ModStep } from '../types';
import { divideFloor, emptyDistribution, scale, shift } from './distribution';

function applyMod(dist: Distribution, step: ModStep): Distribution {
  switch (step.op) {
    case 'add':
      return shift(dist, step.value);
    case 'sub':
      return shift(dist, -step.value);
    case 'mul':
      return scale(dist, step.value);
    case 'div':
      return divideFloor(dist, step.value);
  }
}

/**
 * Folds the chain over a total, first step first.
 *
 * Every step is monotone non-decreasing: a bigger total never comes out
 * smaller. Advantage runs after the chain and is only right because of that, so
 * a multiplier or divisor below 1 comes back empty rather than computed.
 */
export function applyMods(
  dist: Distribution,
  mods: readonly ModStep[] | undefined,
): Distribution {
  if (mods === undefined || mods.length === 0) return dist;
  let result = dist;
  for (const step of mods) {
    result = applyMod(result, step);
    if (result.size === 0) return emptyDistribution();
  }
  return result;
}

/**
 * How many integers a total spanning `width` of them can land on after the
 * chain, without building anything. Exact for add, subtract and multiply. For
 * divide it is the most a range that wide can cover, since where the range
 * starts decides how the rounding falls.
 */
export function modsWidth(width: number, mods: readonly ModStep[] | undefined): number {
  if (mods === undefined || width <= 0) return width;
  let w = width;
  for (const step of mods) {
    if (step.op === 'mul' && step.value > 1) w = (w - 1) * step.value + 1;
    else if (step.op === 'div' && step.value > 1) w = Math.ceil((w - 1) / step.value) + 1;
  }
  return w;
}
