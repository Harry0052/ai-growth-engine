import { retentionCohorts } from "./cohorts";
import { orderedFunnel } from "./funnel";
import { experimentMath, type ExperimentEvent } from "./metrics";
import { getSetting, listEvents, type StoredEvent } from "./repo";
import { funnelSteps } from "./services/tracking";

function parse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type MappedEvent = ExperimentEvent & { ts: number; properties: Record<string, unknown> };

export function mapEvents(rows: StoredEvent[]): MappedEvent[] {
  return rows.map((row) => {
    const properties = parse(row.properties);
    return {
      anonymousId: row.anonymous_id,
      name: row.event_name,
      variant: typeof properties.variant === "string" ? properties.variant : null,
      traffic: row.traffic,
      ts: Number(row.ts),
      properties,
    };
  });
}

export async function loadMappedEvents() {
  const rows = await listEvents("1 = 1", [], 20000);
  return { events: mapEvents(rows), truncated: rows.length >= 20000 };
}

export async function productSnapshot() {
  const { events, truncated } = await loadMappedEvents();
  const product = events.filter((event) => event.traffic === "product");
  const steps = await funnelSteps();
  const funnel = product.length ? orderedFunnel(product.map((event) => ({ anonymous_id: event.anonymousId, event_name: event.name, ts: event.ts })), steps) : null;
  const cohorts = product.length ? retentionCohorts(product.map((event) => ({ anonymous_id: event.anonymousId, ts: event.ts }))) : null;
  const buyers = new Map<string, number>();
  for (const event of product) {
    if (event.name !== "purchase" || !event.anonymousId) continue;
    const cents = typeof event.properties.revenue_cents === "number" ? event.properties.revenue_cents : typeof event.properties.revenue === "number" ? Math.round(event.properties.revenue * 100) : 0;
    buyers.set(event.anonymousId, (buyers.get(event.anonymousId) ?? 0) + cents);
  }
  const ltvCents = buyers.size ? [...buyers.values()].reduce((sum, value) => sum + value, 0) / buyers.size : null;
  return { events, product, funnel, cohorts, ltvCents, buyers: buyers.size, truncated, steps };
}

export async function experimentSnapshot() {
  const { events } = await loadMappedEvents();
  const demo = (await getSetting("demo_mode")) === "1";
  return {
    demo,
    product: experimentMath(events, "signup", "product"),
    test: experimentMath(events, "signup", "live-test"),
    events,
  };
}
