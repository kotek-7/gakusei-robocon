export type TreeRow = { id: string; depth: number; label: string; hint?: string; open?: boolean; pinned?: boolean };

/** Filtering searches every descendant; clearing it restores the expansion state. */
export function visibleRows<T extends TreeRow>(rows: T[], query: string, pinnedOnly: boolean): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const ancestors: number[] = [];
  const visible = new Set<number>();
  const filtering = terms.length > 0 || pinnedOnly;
  rows.forEach((row, index) => {
    ancestors.length = row.depth;
    const parents = ancestors.map((i) => rows[i]);
    if (filtering) {
      const text = [...parents, row].map((r) => r.label + " " + (r.hint ?? "")).join(" ").toLocaleLowerCase();
      const matches = terms.every((term) => text.includes(term));
      const pinned = row.pinned || parents.some((p) => p.pinned);
      if (matches && (!pinnedOnly || pinned)) {
        visible.add(index);
        ancestors.forEach((i) => visible.add(i));
      }
    } else if (parents.every((parent) => parent.open)) {
      visible.add(index);
    }
    ancestors[row.depth] = index;
  });
  return rows.filter((_, index) => visible.has(index));
}
