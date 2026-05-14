import {
  max as distMax,
  mean as distMean,
  min as distMin,
  mode as distMode,
  stddev as distStddev,
} from '../engine/stats';
import type { Distribution } from '../types';

export interface RowStats {
  dist: Distribution;
  hasDist: boolean;
  mean: number;
  min: number;
  max: number;
  mode: number[];
  stddev: number;
}

export function computeRowStats(dist: Distribution): RowStats {
  const hasDist = dist.size > 0;
  return {
    dist,
    hasDist,
    mean: hasDist ? distMean(dist) : 0,
    min: hasDist ? distMin(dist) : 0,
    max: hasDist ? distMax(dist) : 0,
    mode: hasDist ? distMode(dist) : [],
    stddev: hasDist ? distStddev(dist) : 0,
  };
}
