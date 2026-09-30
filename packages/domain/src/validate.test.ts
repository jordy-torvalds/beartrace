import { describe, expect, it } from "vitest";
import { validateRepository, type ParsedRepository } from "./validate.js";
import type { TopicRecord } from "./schemas/topic.js";
import type { SessionRecord } from "./schemas/session.js";
import type { EvidenceRecord } from "./schemas/evidence.js";

function makeTopic(id: string, lineage: Partial<TopicRecord["frontmatter"]> = {}): TopicRecord {
  return {
    kind: "topic",
    path: `topics/${id}.md`,
    body: "",
    frontmatter: {
      schema_version: 1,
      id,
      title: id,
      created_at: "2025-01-01",
      purpose: "Test topic.",
      key_questions: ["Question?"],
      validation_criteria: ["Criterion."],
      ...lineage,
    },
  };
}

function emptyRepo(topics: TopicRecord[]): ParsedRepository {
  return { topics, artifacts: [], sessions: [], evidence: [] };
}

describe("validateRepository", () => {
  it("accepts bidirectional old-to-new topic lineage without a false cycle", () => {
    const diagnostics = validateRepository(
      emptyRepo([
        makeTopic("topic-old", { superseded_by: "topic-new" }),
        makeTopic("topic-new", { supersedes: "topic-old" }),
      ]),
    );

    expect(diagnostics).toEqual([]);
  });

  it("detects actual lineage cycles", () => {
    const diagnostics = validateRepository(
      emptyRepo([
        makeTopic("topic-a", { superseded_by: "topic-b" }),
        makeTopic("topic-b", { superseded_by: "topic-a" }),
      ]),
    );

    expect(diagnostics.some((diagnostic) => diagnostic.code === "E_CYCLE")).toBe(true);
  });

  it("rejects Evidence attached to a non-promoted Session", () => {
    const session: SessionRecord = {
      kind: "session", path: "sessions/rejected.md", body: "failed", frontmatter: {
        schema_version: 1, id: "session-rejected", topic_id: "topic-a", date: "2025-01-02",
        activity_kinds: ["practice"], outcome: "rejected", evidence_ids: ["evidence-invalid"],
      },
    };
    const evidence: EvidenceRecord = {
      kind: "evidence", path: "evidence/invalid.md", body: "claim", frontmatter: {
        schema_version: 1, id: "evidence-invalid", topic_id: "topic-a", session_id: "session-rejected",
        date: "2025-01-02", capabilities: ["explain"], validation_context: "initial",
        ai_assessment: "sufficient", ai_rationale: "looks sufficient", user_approved: true,
        rubric_results: [{ criterion: "explain", passed: true }],
      },
    };
    const diagnostics = validateRepository({ topics: [makeTopic("topic-a")], artifacts: [], sessions: [session], evidence: [evidence] });
    expect(diagnostics.some((item) => item.code === "E_LINEAGE_INCONSISTENT")).toBe(true);
  });
});
