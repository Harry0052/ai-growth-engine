export type FunnelEvent = { anonymous_id: string | null; event_name: string; ts: number };

export type FunnelStep = { step: string; count: number; rateFromStart: number | null; rateFromPrevious: number | null };

/** Ordered funnel: a person counts at a step only if each earlier step happened at an earlier or equal time. */
export function orderedFunnel(events: FunnelEvent[], steps: string[]): FunnelStep[] {
  const byUser = new Map<string, FunnelEvent[]>();
  for (const event of events) {
    if (!event.anonymous_id) continue;
    const list = byUser.get(event.anonymous_id) ?? [];
    list.push(event);
    byUser.set(event.anonymous_id, list);
  }
  for (const list of byUser.values()) list.sort((a, b) => a.ts - b.ts);

  const counts = steps.map((_, index) => {
    let count = 0;
    for (const list of byUser.values()) {
      let cursor = -Infinity;
      let ok = true;
      for (let step = 0; step <= index; step += 1) {
        const hit = list.find((event) => event.event_name === steps[step] && event.ts >= cursor);
        if (!hit) {
          ok = false;
          break;
        }
        cursor = hit.ts;
      }
      if (ok) count += 1;
    }
    return count;
  });

  return steps.map((step, index) => ({
    step,
    count: counts[index],
    rateFromStart: counts[0] > 0 ? counts[index] / counts[0] : null,
    rateFromPrevious: index === 0 ? null : counts[index - 1] > 0 ? counts[index] / counts[index - 1] : null,
  }));
}
