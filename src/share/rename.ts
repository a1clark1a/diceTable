import type { Expression } from '../types';

export function renameCollisions(
  existing: Expression[],
  incoming: Expression[],
): Expression[] {
  const taken = new Set<string>();
  for (const e of existing) taken.add(e.name.trim());

  const result: Expression[] = [];
  for (const expr of incoming) {
    const baseName = expr.name.trim();
    if (!taken.has(baseName)) {
      taken.add(baseName);
      result.push(expr);
      continue;
    }
    let n = 2;
    while (taken.has(`${baseName} (${n})`)) n += 1;
    const renamed = `${baseName} (${n})`;
    taken.add(renamed);
    result.push({ ...expr, name: renamed });
  }
  return result;
}
