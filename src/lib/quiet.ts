export function minutesInZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function parseClock(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 21 * 60;
  return hour * 60 + minute;
}

/** Quiet window may wrap midnight. Equal start and end means quiet hours are off. */
export function isQuiet(now: Date, start: string, end: string, timeZone: string) {
  const current = minutesInZone(now, timeZone);
  const from = parseClock(start);
  const to = parseClock(end);
  if (from === to) return false;
  if (from < to) return current >= from && current < to;
  return current >= from || current < to;
}

export function quietEndsAt(now: Date, start: string, end: string, timeZone: string) {
  if (!isQuiet(now, start, end, timeZone)) return now.getTime();
  for (let step = 1; step <= 24 * 4; step += 1) {
    const next = new Date(now.getTime() + step * 15 * 60 * 1000);
    if (!isQuiet(next, start, end, timeZone)) return next.getTime();
  }
  return now.getTime() + 8 * 60 * 60 * 1000;
}
