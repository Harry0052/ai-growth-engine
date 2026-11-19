const STOP = new Set(
  "a an the and or of to for in on is it this that with your you we our be as at from are was were but if so not just about into over after before they them their i me my he she his her what when who how why can will would should have has had do does did not no yes very really more most than then also only about app apps".split(
    " ",
  ),
);

export function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token.length > 2 && !STOP.has(token) && !/^\d+$/.test(token));
}

export type Cluster = {
  name: string;
  count: number;
  ids: string[];
  examples: string[];
};

export function clusterTexts(items: Array<{ id: string; text: string }>, k = 6): Cluster[] {
  const docs = items.map((item) => ({ ...item, tokens: tokens(item.text) }));
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const token of new Set(doc.tokens)) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const seeds = [...df.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, k)
    .map(([token]) => token);

  const groups = new Map<string, Cluster>();
  for (const seed of seeds) groups.set(seed, { name: seed, count: 0, ids: [], examples: [] });
  const other: Cluster = { name: "other", count: 0, ids: [], examples: [] };

  for (const doc of docs) {
    let best = "";
    let bestScore = 0;
    const tf = new Map<string, number>();
    for (const token of doc.tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    for (const seed of seeds) {
      const score = tf.get(seed) ?? 0;
      if (score > bestScore) {
        best = seed;
        bestScore = score;
      }
    }
    const bucket = best ? groups.get(best)! : other;
    bucket.count += 1;
    bucket.ids.push(doc.id);
    if (bucket.examples.length < 3) bucket.examples.push(doc.text);
  }

  return [...groups.values(), other].filter((group) => group.count > 0);
}

export function mentionCounts(texts: string[], limit = 8) {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const token of new Set(tokens(text))) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}
