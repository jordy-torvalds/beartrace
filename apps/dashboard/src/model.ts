import type {
  Capability,
  CapabilityFreshness,
  ArtifactProjection,
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
  review: "검토",
  explain: "설명",
  transfer: "전이",
  apply: "적용",
};

export const SUMMARY_LABELS_KO: Record<SummaryLabel | "NEW", string> = {
  NEW: "새 주제",
  COLLECTED: "수집됨",
  REVIEWED: "검토됨",
  EXPLAINED: "설명 검증",
  UNDERSTOOD: "이해 검증",
  APPLIED: "적용됨",
  RETAINED: "기억 유지",
};

export const FRESHNESS_LABELS = {
  never: "미검증",
  valid: "유효",
  due: "복습 필요",
  unverified: "재검증 필요",
} as const;

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
    { label: "전체 주제", value: projection.topics.length },
    { label: "이해 검증", value: labelCount(projection, "UNDERSTOOD") },
    { label: "실제 적용", value: labelCount(projection, "APPLIED") },
    { label: "기억 유지", value: labelCount(projection, "RETAINED") },
  ];
}

export function filterArtifacts(
  projection: Projection,
  query: string,
): ArtifactProjection[] {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  const topicTitles = new Map(projection.topics.map((topic) => [topic.id, topic.title]));

  return [...projection.artifacts]
    .filter((artifact) => {
      if (normalized.length === 0) return true;
      const searchable = [
        artifact.title,
        artifact.body_markdown,
        artifact.source.value,
        ...artifact.topic_ids,
        ...artifact.topic_ids.map((id) => topicTitles.get(id) ?? ""),
      ].join(" ").toLocaleLowerCase("ko-KR");
      return searchable.includes(normalized);
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return a.title.localeCompare(b.title, "ko-KR");
    });
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
