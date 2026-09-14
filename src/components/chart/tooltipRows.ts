export interface PartitionedRows<T> {
  /** The lit row, lifted out so the cap can never drop it. */
  pinned: T | null;
  shown: T[];
  hidden: number;
}

/**
 * Splits an already-ordered tooltip list into the lit row and the rest.
 *
 * The pinned row is a row above the cap rather than the first of the capped
 * ones. A capped bar's true value is promised to be on the tooltip, and the
 * existing order puts those rows first to keep that promise; reordering to make
 * room for the lit one would break it at twenty curves, on the rail and on a
 * phone, to solve a problem only the field has.
 *
 * A `litId` the list does not contain, which is what the other panel's pick
 * looks like from here, leaves the output identical to no pick at all.
 */
export function partitionTooltipRows<T extends { id: string }>(
  ordered: readonly T[],
  litId: string | null,
  cap: number,
): PartitionedRows<T> {
  const index =
    litId === null ? -1 : ordered.findIndex((row) => row.id === litId);
  if (index < 0) {
    const shown = ordered.slice(0, cap);
    return { pinned: null, shown, hidden: ordered.length - shown.length };
  }
  const pinned = ordered[index] as T;
  const rest = [...ordered.slice(0, index), ...ordered.slice(index + 1)];
  const shown = rest.slice(0, cap);
  return { pinned, shown, hidden: rest.length - shown.length };
}
