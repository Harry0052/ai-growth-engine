export type CohortEvent = { anonymous_id: string | null; ts: number };

export type CohortRow = { cohort: string; size: number; rates: Array<number | null> };

function weekStart(ts: number) {
  const date = new Date(ts);
  const day = date.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - mondayOffset);
}

function label(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function retentionCohorts(events: CohortEvent[]) {
  const first = new Map<string, number>();
  const active = new Map<string, Set<number>>();
  for (const event of events) {
    if (!event.anonymous_id) continue;
    const week = weekStart(event.ts);
    const seen = first.get(event.anonymous_id);
    if (seen == null || week < seen) first.set(event.anonymous_id, week);
    const set = active.get(event.anonymous_id) ?? new Set<number>();
    set.add(week);
    active.set(event.anonymous_id, set);
  }
  const cohortWeeks = [...new Set(first.values())].sort((a, b) => a - b);
  let maxOffset = 0;
  const grouped = new Map<number, string[]>();
  for (const [id, start] of first) {
    const list = grouped.get(start) ?? [];
    list.push(id);
    grouped.set(start, list);
    for (const week of active.get(id) ?? []) {
      maxOffset = Math.max(maxOffset, Math.round((week - start) / (7 * 24 * 60 * 60 * 1000)));
    }
  }
  maxOffset = Math.min(maxOffset, 8);
  const rows: CohortRow[] = cohortWeeks.map((start) => {
    const ids = grouped.get(start) ?? [];
    const rates = Array.from({ length: maxOffset + 1 }, (_, offset) => {
      if (ids.length === 0) return null;
      const target = start + offset * 7 * 24 * 60 * 60 * 1000;
      const retained = ids.filter((id) => active.get(id)?.has(target)).length;
      return retained / ids.length;
    });
    return { cohort: label(start), size: ids.length, rates };
  });
  return {
    headers: Array.from({ length: maxOffset + 1 }, (_, offset) => `Week ${offset}`),
    rows,
  };
}
