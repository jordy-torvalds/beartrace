import type {
  Capability,
  CapabilityFreshness,
  Projection,
  SummaryLabel,
  TopicProjection,
} from "@beartrace/domain";

export const SUMMARY_ORDER: SummaryLabel[] = [
  "COLLECTED",
  "REVIEWED",
  "EXPLAINED",
  "UNDERSTOOD",
  "APPLIED",
  "RETAINED",
];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  review: "Review",
  explain: "Explain",
  transfer: "Transfer",
  apply: "Apply",
};

export function currentLabel(topic: TopicProjection): SummaryLabel | "NEW" {
  for (let i = SUMMARY_ORDER.length - 1; i >= 0; i -= 1) {
    const label = SUMMARY_ORDER[i];
    if (label && topic.summary_labels.includes(label)) return label;
  }
  return "NEW";
}

export function labelCount(projection: Projection, label: SummaryLabel): number {
  return projection.topics.filter((topic) => topic.summary_labels.includes(label)).length;
}

export function overviewMetrics(projection: Projection) {
  return [
    { label: "Topics", value: projection.topics.length },
    { label: "Understood", value: labelCount(projection, "UNDERSTOOD") },
    { label: "Applied", value: labelCount(projection, "APPLIED") },
    { label: "Retained", value: labelCount(projection, "RETAINED") },
  ];
}

export function recallDueTopics(projection: Projection): TopicProjection[] {
  return [...projection.topics]
    .filter((topic) => topic.next_recall !== null && topic.next_recall <= projection.as_of)
    .sort((a, b) => {
      const nextA = a.next_recall ?? "";
      const nextB = b.next_recall ?? "";
      if (nextA !== nextB) return nextA < nextB ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
}

export function dueCapabilities(topic: TopicProjection): CapabilityFreshness[] {
  return topic.current_freshness.filter(
    (freshness) => freshness.status === "due" || freshness.status === "unverified",
  );
}

export function unverifiedTopics(projection: Projection): TopicProjection[] {
  return [...projection.topics]
    .filter((topic) => {
      const hasCollectedMaterial = topic.artifacts.length > 0 || topic.summary_labels.includes("COLLECTED");
      const lacksCoreValidation = !topic.capability_profile.explain || !topic.capability_profile.transfer;
      const hasExplicitUnverified = topic.current_freshness.some((freshness) => freshness.status === "unverified");
      return (hasCollectedMaterial && lacksCoreValidation) || hasExplicitUnverified;
    })
    .sort((a, b) => {
      const aDate = a.last_activity?.date ?? a.created_at;
      const bDate = b.last_activity?.date ?? b.created_at;
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
}

export function recentTopics(projection: Projection, limit = 6): TopicProjection[] {
  return [...projection.topics]
    .sort((a, b) => {
      const aDate = a.last_activity?.date ?? a.created_at;
      const bDate = b.last_activity?.date ?? b.created_at;
      if (aDate !== bDate) return aDate > bDate ? -1 : 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

export function freshnessFor(topic: TopicProjection, capability: Capability): CapabilityFreshness | undefined {
  return topic.current_freshness.find((freshness) => freshness.capability === capability);
}

export function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}
