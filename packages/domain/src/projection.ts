import { CAPABILITIES, SCHEMA_VERSION, type Capability } from "./schemas/common.js";
import { isValidEvidence } from "./schemas/evidence.js";
import type { BearTraceConfig } from "./schemas/config.js";
import type { ParsedRepository } from "./validate.js";
import { addDays, diffDays } from "./dates.js";

export const PROJECTION_BUILD_VERSION = "0.2.0";

export type FreshnessStatus = "never" | "valid" | "due" | "unverified";

export interface ArtifactSummary {
  id: string;
  kind: string;
  title: string;
  date: string;
}

export interface ArtifactProjection extends ArtifactSummary {
  topic_ids: string[];
  source: {
    kind: string;
    value: string;
    note?: string;
  };
  body_markdown: string;
  attachments?: ArtifactAttachmentProjection[];
}

export interface ArtifactAttachmentProjection {
  path: string;
  media_type: string;
  content: string;
}

export interface SessionSummary {
  id: string;
  date: string;
  activity_kinds: string[];
  outcome: string;
}

export interface EvidenceSummary {
  id: string;
  date: string;
  session_id: string;
  capabilities: Capability[];
  validation_context: string;
  ai_assessment: string;
  user_approved: boolean;
  retested_capabilities?: Capability[];
  valid: boolean;
}

export interface LastActivity {
  date: string;
  kind: "artifact" | "session" | "evidence";
  id: string;
}

export interface CapabilityFreshness {
  capability: Capability;
  status: FreshnessStatus;
  last_validated_at: string | null;
  next_recall_due: string | null;
}

export const SUMMARY_LABELS = [
  "COLLECTED",
  "REVIEWED",
  "EXPLAINED",
  "UNDERSTOOD",
  "APPLIED",
  "RETAINED",
] as const;
export type SummaryLabel = (typeof SUMMARY_LABELS)[number];

export interface HistoricalAttainment {
  label: SummaryLabel;
  achieved: boolean;
  achieved_at: string | null;
}

export interface TopicProjection {
  id: string;
  title: string;
  created_at: string;
  tags: string[];
  artifacts: ArtifactSummary[];
  sessions: SessionSummary[];
  evidence: EvidenceSummary[];
  last_activity: LastActivity | null;
  capability_profile: Record<Capability, boolean>;
  historical_attainment: HistoricalAttainment[];
  current_freshness: CapabilityFreshness[];
  missing_capabilities: Capability[];
  next_recall: string | null;
  summary_labels: SummaryLabel[];
  done_for_current_cycle: boolean;
}

export interface Projection {
  schema_version: number;
  build_version: string;
  as_of: string;
  artifacts: ArtifactProjection[];
  topics: TopicProjection[];
}

function stableSortByDateThenId<T>(items: T[], dateOf: (item: T) => string, idOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const da = dateOf(a);
    const db = dateOf(b);
    if (da !== db) return da < db ? -1 : 1;
    const ia = idOf(a);
    const ib = idOf(b);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}

interface RelevantValidation {
  date: string;
  validationContext: string;
  id: string;
}

function relevantValidationsFor(
  capability: Capability,
  evidenceForTopic: ParsedRepository["evidence"],
): RelevantValidation[] {
  const results: RelevantValidation[] = [];
  for (const e of evidenceForTopic) {
    const fm = e.frontmatter;
    if (!isValidEvidence(fm)) continue;
    if (fm.validation_context === "recall") {
      if (fm.retested_capabilities?.includes(capability)) {
        results.push({ date: fm.date, validationContext: fm.validation_context, id: fm.id });
      }
    } else if (fm.capabilities.includes(capability)) {
      results.push({ date: fm.date, validationContext: fm.validation_context, id: fm.id });
    }
  }
  return results;
}

function computeFreshness(
  capability: Capability,
  evidenceForTopic: ParsedRepository["evidence"],
  sessionsForTopic: ParsedRepository["sessions"],
  config: BearTraceConfig,
  asOf: string,
): CapabilityFreshness {
  const relevant = relevantValidationsFor(capability, evidenceForTopic).filter((item) => item.date <= asOf);
  if (relevant.length === 0) {
    return { capability, status: "never", last_validated_at: null, next_recall_due: null };
  }

  const ordered = stableSortByDateThenId(relevant, (item) => item.date, (item) => item.id);
  const lastValidatedAt = ordered[ordered.length - 1]!.date;
  const intervals = config.recall_intervals_days;
  const latestInitialIndex = ordered.reduce(
    (latest, item, index) => (item.validationContext === "recall" ? latest : index),
    -1,
  );
  const recallCount = ordered.slice(latestInitialIndex + 1).filter((item) => item.validationContext === "recall").length;
  const interval = intervals[Math.min(recallCount, intervals.length - 1)]!;
  const nextRecallDue = addDays(lastValidatedAt, interval);

  const failedRecalls = sessionsForTopic
    .filter((session) => session.frontmatter.date <= asOf)
    .filter((session) => session.frontmatter.activity_kinds.includes("recall_attempt"))
    .filter((session) => session.frontmatter.tested_capabilities?.includes(capability))
    .filter((session) => session.frontmatter.outcome === "rejected" || session.frontmatter.outcome === "abandoned")
    .filter((session) => session.frontmatter.date >= lastValidatedAt);
  const failedRecallAt =
    failedRecalls.length > 0
      ? stableSortByDateThenId(
          failedRecalls,
          (session) => session.frontmatter.date,
          (session) => session.frontmatter.id,
        ).at(-1)!.frontmatter.date
      : null;

  const status: FreshnessStatus = failedRecallAt !== null
    ? "unverified"
    : diffDays(lastValidatedAt, asOf) >= interval
      ? "due"
      : "valid";

  return { capability, status, last_validated_at: lastValidatedAt, next_recall_due: failedRecallAt ?? nextRecallDue };
}

function earliestValidGrantDate(
  capability: Capability,
  evidenceForTopic: ParsedRepository["evidence"],
): string | null {
  let earliest: string | null = null;
  for (const e of evidenceForTopic) {
    const fm = e.frontmatter;
    if (!isValidEvidence(fm)) continue;
    if (!fm.capabilities.includes(capability)) continue;
    if (earliest === null || fm.date < earliest) earliest = fm.date;
  }
  return earliest;
}

function computeHistoricalAttainment(
  topicArtifacts: ParsedRepository["artifacts"],
  evidenceForTopic: ParsedRepository["evidence"],
  config: BearTraceConfig,
): HistoricalAttainment[] {
  const collectedAt =
    topicArtifacts.length > 0
      ? topicArtifacts.reduce((min, a) => (a.frontmatter.date < min ? a.frontmatter.date : min), topicArtifacts[0]!.frontmatter.date)
      : null;

  const reviewedAt = earliestValidGrantDate("review", evidenceForTopic);
  const explainedAt = earliestValidGrantDate("explain", evidenceForTopic);
  const transferAt = earliestValidGrantDate("transfer", evidenceForTopic);
  const appliedAt = earliestValidGrantDate("apply", evidenceForTopic);

  const understoodAt =
    explainedAt !== null && transferAt !== null ? (explainedAt > transferAt ? explainedAt : transferAt) : null;

  let retainedAt: string | null = null;
  if (understoodAt !== null) {
    const firstDelay = config.recall_intervals_days[0]!;
    const qualifyingRecall = (capability: Capability, attainedAt: string): string | null => {
      const eligibleAt = addDays(attainedAt, firstDelay);
      const dates = evidenceForTopic
        .filter((e) => isValidEvidence(e.frontmatter))
        .filter((e) => e.frontmatter.validation_context === "recall")
        .filter((e) => e.frontmatter.retested_capabilities?.includes(capability))
        .map((e) => e.frontmatter.date)
        .filter((date) => date >= eligibleAt)
        .sort();
      return dates[0] ?? null;
    };
    const explainRecall = qualifyingRecall("explain", explainedAt!);
    const transferRecall = qualifyingRecall("transfer", transferAt!);
    if (explainRecall && transferRecall) {
      retainedAt = explainRecall > transferRecall ? explainRecall : transferRecall;
    }
  }

  const entries: Array<[SummaryLabel, string | null]> = [
    ["COLLECTED", collectedAt],
    ["REVIEWED", reviewedAt],
    ["EXPLAINED", explainedAt],
    ["UNDERSTOOD", understoodAt],
    ["APPLIED", appliedAt],
    ["RETAINED", retainedAt],
  ];

  return entries.map(([label, achievedAt]) => ({
    label,
    achieved: achievedAt !== null,
    achieved_at: achievedAt,
  }));
}

export function buildProjection(repo: ParsedRepository, config: BearTraceConfig, asOf: string): Projection {
  const visibleRepo: ParsedRepository = {
    topics: repo.topics.filter((record) => record.frontmatter.created_at <= asOf),
    artifacts: repo.artifacts.filter((record) => record.frontmatter.date <= asOf),
    sessions: repo.sessions.filter((record) => record.frontmatter.date <= asOf),
    evidence: repo.evidence.filter((record) => record.frontmatter.date <= asOf),
  };
  const sortedTopics = stableSortByDateThenId(
    visibleRepo.topics,
    (t) => t.frontmatter.created_at,
    (t) => t.frontmatter.id,
  );

  const artifacts: ArtifactProjection[] = stableSortByDateThenId(
    visibleRepo.artifacts,
    (artifact) => artifact.frontmatter.date,
    (artifact) => artifact.frontmatter.id,
  ).map((artifact) => ({
    id: artifact.frontmatter.id,
    kind: artifact.frontmatter.kind,
    title: artifact.frontmatter.title,
    date: artifact.frontmatter.date,
    topic_ids: [...artifact.frontmatter.topic_ids].sort(),
    source: {
      kind: artifact.frontmatter.source.kind,
      value: artifact.frontmatter.source.value,
      ...(artifact.frontmatter.source.note ? { note: artifact.frontmatter.source.note } : {}),
    },
    body_markdown: artifact.body,
    attachments: (artifact.attachments ?? []).map((attachment) => ({
      path: attachment.path,
      media_type: attachment.media_type,
      content: attachment.content,
    })),
  }));

  const topics: TopicProjection[] = sortedTopics.map((topic) => {
    const topicId = topic.frontmatter.id;

    const topicArtifacts = stableSortByDateThenId(
      visibleRepo.artifacts.filter((a) => a.frontmatter.topic_ids.includes(topicId)),
      (a) => a.frontmatter.date,
      (a) => a.frontmatter.id,
    );
    const topicSessions = stableSortByDateThenId(
      visibleRepo.sessions.filter((s) => s.frontmatter.topic_id === topicId),
      (s) => s.frontmatter.date,
      (s) => s.frontmatter.id,
    );
    const topicEvidence = stableSortByDateThenId(
      visibleRepo.evidence.filter((e) => e.frontmatter.topic_id === topicId),
      (e) => e.frontmatter.date,
      (e) => e.frontmatter.id,
    );

    const artifacts: ArtifactSummary[] = topicArtifacts.map((a) => ({
      id: a.frontmatter.id,
      kind: a.frontmatter.kind,
      title: a.frontmatter.title,
      date: a.frontmatter.date,
    }));
    const sessions: SessionSummary[] = topicSessions.map((s) => ({
      id: s.frontmatter.id,
      date: s.frontmatter.date,
      activity_kinds: [...s.frontmatter.activity_kinds],
      outcome: s.frontmatter.outcome,
    }));
    const evidence: EvidenceSummary[] = topicEvidence.map((e) => ({
      id: e.frontmatter.id,
      date: e.frontmatter.date,
      session_id: e.frontmatter.session_id,
      capabilities: [...e.frontmatter.capabilities],
      validation_context: e.frontmatter.validation_context,
      ai_assessment: e.frontmatter.ai_assessment,
      user_approved: e.frontmatter.user_approved,
      ...(e.frontmatter.retested_capabilities
        ? { retested_capabilities: [...e.frontmatter.retested_capabilities] }
        : {}),
      valid: isValidEvidence(e.frontmatter),
    }));

    const activityCandidates = [
      ...artifacts.map((a) => ({ date: a.date, kind: "artifact" as const, id: a.id })),
      ...sessions.map((s) => ({ date: s.date, kind: "session" as const, id: s.id })),
      ...evidence.map((e) => ({ date: e.date, kind: "evidence" as const, id: e.id })),
    ];
    const sortedActivity = stableSortByDateThenId(
      activityCandidates,
      (x) => x.date,
      (x) => x.id,
    );
    const lastActivity: LastActivity | null =
      sortedActivity.length > 0 ? sortedActivity[sortedActivity.length - 1]! : null;

    const capabilityProfile: Record<Capability, boolean> = Object.fromEntries(
      CAPABILITIES.map((c) => [c, earliestValidGrantDate(c, topicEvidence) !== null]),
    ) as Record<Capability, boolean>;

    const historicalAttainment = computeHistoricalAttainment(topicArtifacts, topicEvidence, config);

    const currentFreshness = CAPABILITIES.map((c) =>
      computeFreshness(c, topicEvidence, topicSessions, config, asOf),
    );

    const missingCapabilities = CAPABILITIES.filter((c) => !capabilityProfile[c]);

    const recallCandidates = currentFreshness
      .filter((f) => f.status !== "never" && f.next_recall_due !== null)
      .map((f) => f.next_recall_due as string);
    const nextRecall =
      recallCandidates.length > 0 ? recallCandidates.reduce((min, d) => (d < min ? d : min)) : null;

    const summaryLabels = historicalAttainment.filter((h) => h.achieved).map((h) => h.label);

    const doneForCurrentCycle = capabilityProfile.explain && capabilityProfile.transfer;

    return {
      id: topicId,
      title: topic.frontmatter.title,
      created_at: topic.frontmatter.created_at,
      tags: [...(topic.frontmatter.tags ?? [])],
      artifacts,
      sessions,
      evidence,
      last_activity: lastActivity,
      capability_profile: capabilityProfile,
      historical_attainment: historicalAttainment,
      current_freshness: currentFreshness,
      missing_capabilities: missingCapabilities,
      next_recall: nextRecall,
      summary_labels: summaryLabels,
      done_for_current_cycle: doneForCurrentCycle,
    };
  });

  return {
    schema_version: SCHEMA_VERSION,
    build_version: PROJECTION_BUILD_VERSION,
    as_of: asOf,
    artifacts,
    topics,
  };
}
