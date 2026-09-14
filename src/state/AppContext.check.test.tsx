import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { validateExpression } from './persistedSchema';
import type { CheckSpec, Expression, ExpressionMode } from '../types';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Row 0',
    parts: [{ id: 'p0', count: 1, sides: 20 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function importedCheckRow(): Expression {
  return {
    id: 'imported-expr',
    name: 'Longsword',
    parts: [{ id: 'imported-check-die', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: {
        parts: [{ id: 'imported-effect-die', count: 1, sides: 8 }],
        flatModifier: 3,
      },
      onSuccess: 'full',
      onFailure: 'none',
    },
  };
}

function seedRows(expressions: Expression[]) {
  const state = {
    version: 4,
    expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table' as const,
      poolTarget: 1,
      baselineId: null,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

// Mirrors a reload: only what survives JSON and the validator comes back, and a
// row the validator rejects takes the whole saved table with it.
function afterReload(expr: Expression): Expression | null {
  return validateExpression(JSON.parse(JSON.stringify(expr)) as unknown);
}

// Optional chaining off a missing check silently turns every assertion about
// the spec into a comparison against undefined, which passes for "crit is gone"
// and "the id changed" alike. Reaching the spec through here fails loudly
// instead when the whole check went missing.
function checkOf(expr: Expression): CheckSpec {
  const check = expr.check;
  if (check === undefined) {
    throw new Error(`expected row "${expr.name}" to carry a check spec`);
  }
  return check;
}

function setup(seed: Expression[] = [sumRow()]) {
  seedRows(seed);
  const { result } = renderHook(() => useApp(), { wrapper });
  return {
    result,
    id: seed[0]!.id,
    row: () => result.current.expressions[0]!,
  };
}

function switchTo(
  result: { current: ReturnType<typeof useApp> },
  id: string,
  mode: ExpressionMode,
) {
  act(() => {
    result.current.updateExpression(id, { mode });
  });
}

function patchCheck(
  result: { current: ReturnType<typeof useApp> },
  id: string,
  spec: CheckSpec,
) {
  act(() => {
    result.current.updateExpression(id, { check: spec });
  });
}

describe('AppContext seeding a check row', () => {
  it('seeds a threshold of 10 on a d20 row', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 10 });
  });

  it('seeds a single 1d6 effect', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    const parts = row().check?.effect.parts;
    expect(parts).toHaveLength(1);
    expect(parts?.[0]?.count).toBe(1);
    expect(parts?.[0]?.sides).toBe(6);
  });

  it('seeds the effect with no flat modifier of its own', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(row().check?.effect.flatModifier).toBe(0);
  });

  it('seeds the full effect on a success', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(row().check?.onSuccess).toBe('full');
  });

  it('seeds no effect on a failure', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(row().check?.onFailure).toBe('none');
  });

  it('seeds no critical rule', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('seeds a row that survives a reload through the validator', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    const reloaded = afterReload(row());
    expect(reloaded).not.toBeNull();
    expect(reloaded?.mode).toBe('check');
    expect(reloaded?.check?.threshold).toEqual({ direction: 'gte', value: 10 });
  });

  it('seeds a threshold of 6 when the first die is a d6', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 1, sides: 6 }] }),
    ]);
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 6 });
  });

  it('seeds a threshold of 2 when the first die is a d2', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 1, sides: 2 }] }),
    ]);
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 2 });
  });

  it('caps the seeded threshold at 10 on a d100 row', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 1, sides: 100 }] }),
    ]);
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 10 });
  });

  it('reads the seeded threshold off the first part of a multi-part row', () => {
    const { result, id, row } = setup([
      sumRow({
        parts: [
          { id: 'p0', count: 1, sides: 4 },
          { id: 'p1', count: 1, sides: 20 },
        ],
      }),
    ]);
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 4 });
  });

  it('keeps the row dice as the check roll', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 1, sides: 12 }] }),
    ]);
    switchTo(result, id, 'check');
    expect(row().parts).toEqual([{ id: 'p0', count: 1, sides: 12 }]);
  });

  it('keeps the flat modifier on the check roll', () => {
    const { result, id, row } = setup([sumRow({ flatModifier: 7 })]);
    switchTo(result, id, 'check');
    expect(row().flatModifier).toBe(7);
  });

  it('keeps the roll mode on the check roll', () => {
    const { result, id, row } = setup([sumRow({ rollMode: 'advantage' })]);
    switchTo(result, id, 'check');
    expect(row().rollMode).toBe('advantage');
  });

  it('keeps a per-part keep rule on the check roll', () => {
    const { result, id, row } = setup([
      sumRow({
        parts: [
          { id: 'p0', count: 2, sides: 20, keep: { type: 'highest', n: 1 } },
        ],
      }),
    ]);
    switchTo(result, id, 'check');
    expect(row().parts[0]?.keep).toEqual({ type: 'highest', n: 1 });
    expect(afterReload(row())).not.toBeNull();
  });

  // The pool switch strips explode and reroll off every part; the check switch
  // must not, because a check still rolls the row's dice for real.
  it('keeps explode and reroll rules on the check roll', () => {
    const { result, id, row } = setup([
      sumRow({
        parts: [
          {
            id: 'p0',
            count: 1,
            sides: 20,
            explode: { onFaces: [20], depthCap: 3 },
            reroll: { values: [1], mode: 'once' },
          },
        ],
      }),
    ]);
    switchTo(result, id, 'check');
    expect(row().parts[0]?.explode).toEqual({ onFaces: [20], depthCap: 3 });
    expect(row().parts[0]?.reroll).toEqual({ values: [1], mode: 'once' });
    expect(afterReload(row())).not.toBeNull();
  });

  it('gives the seeded effect a part id of its own, not the check die id', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    const effectId = checkOf(row()).effect.parts[0]?.id;
    expect(effectId).toEqual(expect.any(String));
    expect(effectId).not.toBe(row().parts[0]?.id);
  });

  it('leaves an edited spec alone when the mode patch repeats check', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    patchCheck(result, id, {
      ...row().check!,
      threshold: { direction: 'gte', value: 17 },
    });
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 17 });
  });
});

describe('AppContext switching in and out of check mode', () => {
  it('drops keepAcross when a sum row switches to check', () => {
    const { result, id, row } = setup([
      sumRow({
        parts: [
          { id: 'p0', count: 1, sides: 20 },
          { id: 'p1', count: 1, sides: 6 },
        ],
        keepAcross: { type: 'highest', n: 1 },
      }),
    ]);
    expect(row().keepAcross).toBeDefined();
    switchTo(result, id, 'check');
    expect(row().keepAcross).toBeUndefined();
  });

  it('leaves the row valid after keepAcross is dropped on the way into check', () => {
    const { result, id, row } = setup([
      sumRow({
        parts: [
          { id: 'p0', count: 1, sides: 20 },
          { id: 'p1', count: 1, sides: 6 },
        ],
        keepAcross: { type: 'highest', n: 1 },
      }),
    ]);
    switchTo(result, id, 'check');
    expect(afterReload(row())).not.toBeNull();
  });

  it('drops successThreshold when a pool row switches to check', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 5, sides: 6 }] }),
    ]);
    switchTo(result, id, 'pool');
    expect(row().successThreshold).toBeDefined();
    switchTo(result, id, 'check');
    expect(row().successThreshold).toBeUndefined();
  });

  it('seeds a check when a pool row switches to check', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 5, sides: 6 }] }),
    ]);
    switchTo(result, id, 'pool');
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 6 });
  });

  it('drops the check when a check row switches back to sum', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    switchTo(result, id, 'sum');
    expect(row().mode).toBe('sum');
    expect(row().check).toBeUndefined();
  });

  it('drops the check when a check row switches to pool', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    switchTo(result, id, 'pool');
    expect(row().mode).toBe('pool');
    expect(row().check).toBeUndefined();
  });

  it('seeds a success threshold when a check row switches to pool', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 5, sides: 6 }] }),
    ]);
    switchTo(result, id, 'check');
    switchTo(result, id, 'pool');
    expect(row().successThreshold).toEqual({ direction: 'gte', value: 4 });
  });

  it('leaves the row valid at every step of check to pool and back', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(afterReload(row())).not.toBeNull();
    switchTo(result, id, 'pool');
    expect(afterReload(row())).not.toBeNull();
    switchTo(result, id, 'check');
    expect(afterReload(row())).not.toBeNull();
  });

  it('re-seeds rather than resurrecting an edited threshold across a pool detour', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    patchCheck(result, id, {
      ...row().check!,
      threshold: { direction: 'lte', value: 3 },
    });
    switchTo(result, id, 'pool');
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 10 });
  });

  it('re-seeds rather than resurrecting an edited effect across a pool detour', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    patchCheck(result, id, {
      ...row().check!,
      effect: {
        parts: [{ id: 'hand-rolled', count: 3, sides: 10 }],
        flatModifier: 4,
      },
    });
    switchTo(result, id, 'pool');
    switchTo(result, id, 'check');
    const parts = row().check?.effect.parts;
    expect(parts).toHaveLength(1);
    expect(parts?.[0]?.sides).toBe(6);
    expect(parts?.[0]?.id).not.toBe('hand-rolled');
    expect(row().check?.effect.flatModifier).toBe(0);
  });

  it('re-seeds rather than resurrecting a critical across a pool detour', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    patchCheck(result, id, {
      ...row().check!,
      crit: { onFaces: [20], effect: 'doubleDice' },
    });
    expect(row().check?.crit).toBeDefined();
    switchTo(result, id, 'pool');
    switchTo(result, id, 'check');
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('re-seeds the threshold from the dice as they stand after the pool detour', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    switchTo(result, id, 'pool');
    act(() => {
      result.current.updatePart(id, 'p0', { sides: 6 });
    });
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 6 });
  });

  it('re-seeds rather than resurrecting an edited spec across a sum detour', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    patchCheck(result, id, {
      ...row().check!,
      threshold: { direction: 'lte', value: 3 },
      onFailure: 'half',
    });
    switchTo(result, id, 'sum');
    switchTo(result, id, 'check');
    expect(row().check?.threshold).toEqual({ direction: 'gte', value: 10 });
    expect(row().check?.onFailure).toBe('none');
  });
});

describe('AppContext dropping an unreadable critical', () => {
  function setupWithCrit() {
    const ctx = setup();
    switchTo(ctx.result, ctx.id, 'check');
    patchCheck(ctx.result, ctx.id, {
      ...ctx.row().check!,
      crit: { onFaces: [20], effect: 'doubleDice' },
    });
    return ctx;
  }

  // A shrink that leaves no readable face drops the rule instead; that lives
  // with the clamping cases below.
  it('keeps the critical while the die still shows its faces', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.updatePart(id, 'p0', { sides: 100 });
    });
    expect(row().check?.crit).toEqual({ onFaces: [20], effect: 'doubleDice' });
  });

  it('keeps the critical through an unrelated edit', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.updateExpression(id, { flatModifier: 4 });
    });
    expect(checkOf(row()).crit).toEqual({ onFaces: [20], effect: 'doubleDice' });
  });

  it('drops the critical when the check die count rises above 1', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.updatePart(id, 'p0', { count: 2 });
    });
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('leaves the row valid after the count raise drops the critical', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.updatePart(id, 'p0', { count: 2 });
    });
    expect(afterReload(row())).not.toBeNull();
  });

  it('drops the critical when a second part joins the check roll', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.addPart(id);
    });
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('leaves the row valid after the extra part drops the critical', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.addPart(id);
    });
    expect(afterReload(row())).not.toBeNull();
  });

  it('leaves the rest of the spec intact when the critical is dropped', () => {
    const { result, id, row } = setupWithCrit();
    const before = row().check!;
    act(() => {
      result.current.updatePart(id, 'p0', { count: 2 });
    });
    expect(row().check?.threshold).toEqual(before.threshold);
    expect(row().check?.effect).toEqual(before.effect);
    expect(row().check?.onSuccess).toBe(before.onSuccess);
  });

  it('does not resurrect the critical when the die count returns to 1', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.updatePart(id, 'p0', { count: 2 });
    });
    act(() => {
      result.current.updatePart(id, 'p0', { count: 1 });
    });
    expect(row().parts[0]?.count).toBe(1);
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('does not resurrect the critical when the extra part is removed', () => {
    const { result, id, row } = setupWithCrit();
    act(() => {
      result.current.addPart(id);
    });
    const extraId = row().parts[1]!.id;
    act(() => {
      result.current.removePart(id, extraId);
    });
    expect(row().parts).toHaveLength(1);
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('drops a critical that arrives in a patch on a multi-die check roll', () => {
    const { result, id, row } = setup([
      sumRow({ parts: [{ id: 'p0', count: 2, sides: 20 }] }),
    ]);
    switchTo(result, id, 'check');
    patchCheck(result, id, {
      ...row().check!,
      crit: { onFaces: [20], effect: 'extraDie' },
    });
    expect(checkOf(row()).crit).toBeUndefined();
    expect(afterReload(row())).not.toBeNull();
  });
});

describe('AppContext copying and importing check rows', () => {
  it('re-ids the effect parts through replaceExpressions', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([importedCheckRow()]);
    });
    const landed = result.current.expressions[0]!;
    const effectParts = checkOf(landed).effect.parts;
    expect(effectParts).toHaveLength(1);
    expect(effectParts[0]?.id).toEqual(expect.any(String));
    expect(landed.id).not.toBe('imported-expr');
    expect(landed.parts[0]?.id).not.toBe('imported-check-die');
    expect(effectParts[0]?.id).not.toBe('imported-effect-die');
  });

  it('keeps the spec values through replaceExpressions', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([importedCheckRow()]);
    });
    const landed = result.current.expressions[0]!;
    expect(checkOf(landed).threshold).toEqual({ direction: 'gte', value: 15 });
    expect(checkOf(landed).effect.parts[0]?.sides).toBe(8);
    expect(checkOf(landed).effect.flatModifier).toBe(3);
    expect(afterReload(landed)).not.toBeNull();
  });

  it('re-ids the effect parts through addExpressions', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.addExpressions([importedCheckRow()]);
    });
    const landed = result.current.expressions[0]!;
    const effectId = checkOf(landed).effect.parts[0]?.id;
    expect(effectId).toEqual(expect.any(String));
    expect(landed.parts[0]?.id).not.toBe('imported-check-die');
    expect(effectId).not.toBe('imported-effect-die');
  });

  it('gives two copies of the same imported row distinct effect part ids', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.addExpressions([importedCheckRow(), importedCheckRow()]);
    });
    expect(result.current.expressions).toHaveLength(2);
    const [first, second] = result.current.expressions;
    const firstEffectId = checkOf(first!).effect.parts[0]?.id;
    const secondEffectId = checkOf(second!).effect.parts[0]?.id;
    expect(firstEffectId).toEqual(expect.any(String));
    expect(firstEffectId).not.toBe(secondEffectId);
  });

  it('does not mutate the incoming expression objects', () => {
    const incoming = importedCheckRow();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([incoming]);
    });
    expect(incoming.id).toBe('imported-expr');
    expect(incoming.parts[0]?.id).toBe('imported-check-die');
    expect(incoming.check?.effect.parts[0]?.id).toBe('imported-effect-die');
  });

  it('leaves a row without a check free of one after the re-id', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([sumRow()]);
    });
    expect(result.current.expressions[0]!.check).toBeUndefined();
    expect('check' in result.current.expressions[0]!).toBe(false);
  });
});

describe('AppContext clamping critical faces to the check die', () => {
  function setupWithCrit(onFaces: number[] = [20]) {
    const ctx = setup();
    switchTo(ctx.result, ctx.id, 'check');
    patchCheck(ctx.result, ctx.id, {
      ...ctx.row().check!,
      crit: { onFaces, effect: 'doubleDice' },
    });
    return ctx;
  }

  it('drops a crit face the shrunken die can no longer show', () => {
    const { result, id, row } = setupWithCrit([5, 20]);
    act(() => {
      result.current.updatePart(id, 'p0', { sides: 6 });
    });
    expect(checkOf(row()).crit).toEqual({ onFaces: [5], effect: 'doubleDice' });
  });

  it('drops the whole critical when no face survives the shrink', () => {
    const { result, id, row } = setupWithCrit([20]);
    act(() => {
      result.current.updatePart(id, 'p0', { sides: 6 });
    });
    expect(checkOf(row()).crit).toBeUndefined();
  });

  it('leaves the row valid after the shrink drops the critical', () => {
    const { result, id, row } = setupWithCrit([20]);
    act(() => {
      result.current.updatePart(id, 'p0', { sides: 6 });
    });
    expect(afterReload(row())).not.toBeNull();
  });

  // Envelopes written before the clamp existed can already hold the stale
  // face; hydration must heal them rather than carry the inert rule forward.
  it('heals a stale crit face on hydration', () => {
    seedRows([
      {
        ...sumRow({ parts: [{ id: 'p0', count: 1, sides: 6 }] }),
        mode: 'check',
        check: {
          threshold: { direction: 'gte', value: 4 },
          effect: {
            parts: [{ id: 'fx', count: 1, sides: 6 }],
            flatModifier: 0,
          },
          onSuccess: 'full',
          onFailure: 'none',
          crit: { onFaces: [20], effect: 'doubleDice' },
        },
      },
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toHaveLength(1);
    expect(checkOf(result.current.expressions[0]!).crit).toBeUndefined();
  });
});

describe('AppContext explicit check patches', () => {
  const replacement: CheckSpec = {
    threshold: { direction: 'lte', value: 4 },
    effect: {
      parts: [{ id: 'patched-effect-die', count: 2, sides: 4 }],
      flatModifier: 1,
    },
    onSuccess: 'half',
    onFailure: 'full',
  };

  it('replaces the whole spec when the patch carries one', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    patchCheck(result, id, replacement);
    expect(row().check).toEqual(replacement);
  });

  it('clears the spec when the patch passes undefined', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    expect(row().check).toBeDefined();
    act(() => {
      result.current.updateExpression(id, { check: undefined });
    });
    expect(row().check).toBeUndefined();
    expect('check' in row()).toBe(false);
  });

  it('leaves the spec alone when the patch does not mention it', () => {
    const { result, id, row } = setup();
    switchTo(result, id, 'check');
    const before = row().check;
    act(() => {
      result.current.renameExpression(id, 'Renamed');
    });
    expect(row().name).toBe('Renamed');
    expect(row().check).toEqual(before);
  });
});
