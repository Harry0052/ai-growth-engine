import type { Cluster } from "./cluster";
import { clip } from "./format";

export function featureGapMarkdown(appName: string, reviewCount: number, clusters: Cluster[]) {
  const lines = [
    `# Feature gap · ${appName}`,
    "",
    `Grouped ${reviewCount} live Apple reviews by shared words. This is keyword clustering, not a model, and it does not invent feature requests.`,
    "",
  ];
  if (!clusters.length) {
    lines.push("No review text was available to group.");
    return lines.join("\n");
  }
  for (const cluster of clusters) {
    lines.push(`## ${cluster.name} · ${cluster.count} review${cluster.count === 1 ? "" : "s"}`);
    for (const example of cluster.examples) {
      lines.push(`- “${clip(example, 220)}”`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
