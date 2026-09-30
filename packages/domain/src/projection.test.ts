import { describe, expect, it } from "vitest";
import { buildProjection } from "./projection.js";
import { DEFAULT_CONFIG } from "./schemas/config.js";
import type { ArtifactRecord } from "./schemas/artifact.js";
import type { EvidenceRecord } from "./schemas/evidence.js";
import type { SessionRecord } from "./schemas/session.js";
import type { TopicRecord } from "./schemas/topic.js";
import type { ParsedRepository } from "./validate.js";

function topic(id = "topic-alpha"): TopicRecord {
  return {
    kind: "topic",
    path: `topics/${id}.md`,
    body: "Topic notes",
    frontmatter: {
      schema_version: 1,
      id,
      title: "Topic Alpha",
      created_at: "2025-01-01",
      purpose: "Learn the topic.",
      key_questions: ["What matters?"],
      validation_criteria: ["Can explain and transfer."],
    },
  };
}

function artifact(topicId = "topic-alpha"): ArtifactRecord {
  return {
    kind: "artifact",
    path: "artifacts/artifact-alpha.md",
    body: "# Artifact body\n\nReadable report content.",
    frontmatter: {
      schema_version: 1,
      id: "artifact-alpha",
      kind: "article",
      title: "Artifact Alpha",
      date: "2025-01-01",
      topic_ids: [topicId],
      source: { kind: "url", value: "https://example.com" },
    },
  };
}

function session(
  id: string,
  date: string,
  outcome: SessionRecord["frontmatter"]["outcome"],
  evidenceIds: string[] = [],
  testedCapabilities?: SessionRecord["frontmatter"]["tested_capabilities"],
): SessionRecord {
  return {
    kind: "session",
    path: `sessions/${id}.md`,
    body: "Session body must stay out.",
    frontmatter: {
      schema_version: 1,
      id,
      topic_id: "topic-alpha",
      date,
      activity_kinds: testedCapabilities ? ["recall_attempt"] : ["practice"],
      outcome,
      ...(evidenceIds.length > 0 ? { evidence_ids: evidenceIds } : {}),
      ...(testedCapabilities ? { tested_capabilities: testedCapabilities } : {}),
    },
  };
}

function evidence(
  id: string,
  date: string,
  capabilities: EvidenceRecord["frontmatter"]["capabilities"],
  sessionId: string,
  extra: Partial<EvidenceRecord["frontmatter"]> = {},
): EvidenceRecord {
  return {
    kind: "evidence",
    path: `evidence/${id}.md`,
    body: "Proof body must stay out.",
    frontmatter: {
      schema_version: 1,
      id,
      topic_id: "topic-alpha",
      session_id: sessionId,
      date,
      capabilities,
      validation_context: "initial",
      ai_assessment: "sufficient",
      ai_rationale: "Rationale must stay out.",
      user_approved: true,
      rubric_results: [{ criterion: "Works", passed: true }],
      ...extra,
    },
  };
}

function repo(parts: Partial<ParsedRepository>): ParsedRepository {
  return {
    topics: [topic()],
    artifacts: [],
    sessions: [],
    evidence: [],
    ...parts,
  };
}

describe("buildProjection", () => {
  it("keeps artifacts and sessions from granting capability", () => {
    const projection = buildProjection(
      repo({
        artifacts: [artifact()],
        sessions: [session("session-alpha", "2025-01-02", "promoted")],
      }),
      DEFAULT_CONFIG,
      "2025-01-03",
    );

    const alpha = projection.topics[0]!;
    expect(alpha.summary_labels).toEqual(["COLLECTED"]);
    expect(alpha.capability_profile).toEqual({ review: false, explain: false, transfer: false, apply: false });
    expect(alpha.done_for_current_cycle).toBe(false);
  });

  it("marks DONE and UNDERSTOOD only from valid explain plus transfer evidence", () => {
    const projection = buildProjection(
      repo({
        sessions: [session("session-explain", "2025-01-02", "promoted", ["evidence-explain", "evidence-transfer"])],
        evidence: [
          evidence("evidence-explain", "2025-01-02", ["explain"], "session-explain"),
          evidence("evidence-transfer", "2025-01-03", ["transfer"], "session-explain"),
        ],
      }),
      DEFAULT_CONFIG,
      "2025-01-04",
    );

    const alpha = projection.topics[0]!;
    expect(alpha.summary_labels).toContain("EXPLAINED");
    expect(alpha.summary_labels).toContain("UNDERSTOOD");
    expect(alpha.done_for_current_cycle).toBe(true);
  });

  it("keeps DONE after explain and transfer become due", () => {
    const projection = buildProjection(
      repo({
        sessions: [session("session-done", "2025-01-01", "promoted", ["evidence-explain", "evidence-transfer"])],
        evidence: [
          evidence("evidence-explain", "2025-01-01", ["explain"], "session-done"),
          evidence("evidence-transfer", "2025-01-01", ["transfer"], "session-done"),
        ],
      }),
      DEFAULT_CONFIG,
      "2025-02-01",
    );

    expect(projection.topics[0]!.current_freshness.filter((item) => item.status === "due")).toHaveLength(2);
    expect(projection.topics[0]!.done_for_current_cycle).toBe(true);
  });

  it("lets apply exist out of order without implying explain or transfer", () => {
    const projection = buildProjection(
      repo({
        sessions: [session("session-apply", "2025-01-02", "promoted", ["evidence-apply"])],
        evidence: [
          evidence("evidence-apply", "2025-01-02", ["apply"], "session-apply", {
            validation_context: "application",
          }),
        ],
      }),
      DEFAULT_CONFIG,
      "2025-01-03",
    );

    const alpha = projection.topics[0]!;
    expect(alpha.summary_labels).toEqual(["APPLIED"]);
    expect(alpha.capability_profile.apply).toBe(true);
    expect(alpha.done_for_current_cycle).toBe(false);
  });

  it("refreshes only retested capabilities during delayed recall", () => {
    const projection = buildProjection(
      repo({
        sessions: [
          session("session-initial", "2025-01-01", "promoted", ["evidence-explain", "evidence-transfer"]),
          session("session-recall", "2025-01-08", "promoted", ["evidence-recall"], ["explain"]),
        ],
        evidence: [
          evidence("evidence-explain", "2025-01-01", ["explain"], "session-initial"),
          evidence("evidence-transfer", "2025-01-01", ["transfer"], "session-initial"),
          evidence("evidence-recall", "2025-01-08", ["explain"], "session-recall", {
            validation_context: "recall",
            retested_capabilities: ["explain"],
          }),
        ],
      }),
      DEFAULT_CONFIG,
      "2025-01-10",
    );

    const freshness = projection.topics[0]!.current_freshness;
    expect(freshness.find((f) => f.capability === "explain")).toMatchObject({
      status: "valid",
      last_validated_at: "2025-01-08",
      next_recall_due: "2025-02-07",
    });
    expect(freshness.find((f) => f.capability === "transfer")).toMatchObject({
      status: "due",
      last_validated_at: "2025-01-01",
      next_recall_due: "2025-01-08",
    });
  });

  it("marks failed recall as unverified without erasing last successful validation", () => {
    const projection = buildProjection(
      repo({
        sessions: [
          session("session-initial", "2025-01-01", "promoted", ["evidence-explain"]),
          session("session-failed", "2025-01-09", "rejected", [], ["explain"]),
        ],
        evidence: [evidence("evidence-explain", "2025-01-01", ["explain"], "session-initial")],
      }),
      DEFAULT_CONFIG,
      "2025-01-10",
    );

    expect(projection.topics[0]!.current_freshness.find((f) => f.capability === "explain")).toMatchObject({
      status: "unverified",
      last_validated_at: "2025-01-01",
      next_recall_due: "2025-01-09",
    });
  });

  it("requires delayed recall of both DONE capabilities for RETAINED", () => {
    const projection = buildProjection(
      repo({
        sessions: [
          session("session-initial", "2025-01-01", "promoted", ["evidence-explain", "evidence-transfer"]),
          session("session-recall-explain", "2025-01-08", "promoted", ["evidence-recall-explain"], ["explain"]),
          session("session-recall-transfer", "2025-01-09", "promoted", ["evidence-recall-transfer"], ["transfer"]),
        ],
        evidence: [
          evidence("evidence-explain", "2025-01-01", ["explain"], "session-initial"),
          evidence("evidence-transfer", "2025-01-01", ["transfer"], "session-initial"),
          evidence("evidence-recall-explain", "2025-01-08", ["explain"], "session-recall-explain", {
            validation_context: "recall",
            retested_capabilities: ["explain"],
          }),
          evidence("evidence-recall-transfer", "2025-01-09", ["transfer"], "session-recall-transfer", {
            validation_context: "recall",
            retested_capabilities: ["transfer"],
          }),
        ],
      }),
      DEFAULT_CONFIG,
      "2025-01-10",
    );

    expect(projection.topics[0]!.historical_attainment.find((h) => h.label === "RETAINED")).toMatchObject({
      achieved: true,
      achieved_at: "2025-01-09",
    });
  });

  it("includes artifact reports but omits private session and evidence details", () => {
    const projection = buildProjection(
      repo({
        artifacts: [artifact()],
        sessions: [session("session-future", "2025-02-01", "promoted", ["evidence-future"])],
        evidence: [evidence("evidence-future", "2025-02-01", ["explain"], "session-future")],
      }),
      DEFAULT_CONFIG,
      "2025-01-15",
    );
    const serialized = JSON.stringify(projection);

    expect(projection.topics[0]!.evidence).toEqual([]);
    expect(projection.artifacts).toEqual([
      expect.objectContaining({
        id: "artifact-alpha",
        topic_ids: ["topic-alpha"],
        body_markdown: "# Artifact body\n\nReadable report content.",
      }),
    ]);
    expect(serialized).toContain("Readable report content");
    expect(serialized).not.toContain("Session body must stay out");
    expect(serialized).not.toContain("Proof body must stay out");
    expect(serialized).not.toContain("Rationale must stay out");
    expect(serialized).not.toContain("/Users/");
  });
});
