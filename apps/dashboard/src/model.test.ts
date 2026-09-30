import { describe, expect, it } from "vitest";
import type { Projection, TopicProjection } from "@beartrace/domain";
import { currentLabel, dueCapabilities, labelCount, recallDueTopics, recentTopics, unverifiedTopics } from "./model.js";

const baseTopic = {
  id: "topic-a",
  title: "Topic A",
  created_at: "2026-01-01",
  tags: [],
  artifacts: [],
  sessions: [],
  evidence: [],
  last_activity: null,
  capability_profile: {
    review: false,
    explain: false,
    transfer: false,
    apply: false,
  },
  historical_attainment: [],
  current_freshness: [],
  missing_capabilities: ["review", "explain", "transfer", "apply"],
  next_recall: null,
  summary_labels: [],
  done_for_current_cycle: false,
} satisfies TopicProjection;

function topic(overrides: Partial<TopicProjection>): TopicProjection {
  return { ...baseTopic, ...overrides };
}

function projection(topics: TopicProjection[]): Projection {
  return {
    schema_version: 1,
    build_version: "test",
    as_of: "2026-02-10",
    topics,
  };
}

describe("dashboard projection helpers", () => {
  it("selects the highest achieved label", () => {
    expect(currentLabel(topic({ summary_labels: ["COLLECTED", "UNDERSTOOD"] }))).toBe("UNDERSTOOD");
    expect(currentLabel(topic({ summary_labels: [] }))).toBe("NEW");
  });

  it("counts labels independently", () => {
    const data = projection([
      topic({ id: "a", summary_labels: ["COLLECTED", "UNDERSTOOD"] }),
      topic({ id: "b", summary_labels: ["COLLECTED"] }),
    ]);

    expect(labelCount(data, "COLLECTED")).toBe(2);
    expect(labelCount(data, "UNDERSTOOD")).toBe(1);
  });

  it("orders due recalls by due date", () => {
    const data = projection([
      topic({ id: "later", title: "Later", next_recall: "2026-02-10" }),
      topic({ id: "future", title: "Future", next_recall: "2026-02-11" }),
      topic({ id: "earlier", title: "Earlier", next_recall: "2026-02-01" }),
    ]);

    expect(recallDueTopics(data).map((item) => item.id)).toEqual(["earlier", "later"]);
  });

  it("surfaces collected topics missing explain or transfer, plus explicit unverified topics", () => {
    const data = projection([
      topic({
        id: "valid",
        artifacts: [{ id: "a", kind: "report", title: "A", date: "2026-01-01" }],
        summary_labels: ["COLLECTED", "EXPLAINED", "UNDERSTOOD"],
        capability_profile: { review: false, explain: true, transfer: true, apply: false },
        current_freshness: [
          { capability: "explain", status: "valid", last_validated_at: "2026-02-01", next_recall_due: "2026-03-01" },
          { capability: "apply", status: "never", last_validated_at: null, next_recall_due: null },
        ],
      }),
      topic({
        id: "missing-transfer",
        artifacts: [{ id: "b", kind: "report", title: "B", date: "2026-01-01" }],
        summary_labels: ["COLLECTED", "EXPLAINED"],
        capability_profile: { review: false, explain: true, transfer: false, apply: false },
      }),
      topic({
        id: "unverified",
        capability_profile: { review: false, explain: true, transfer: true, apply: false },
        current_freshness: [{ capability: "explain", status: "unverified", last_validated_at: "2026-02-01", next_recall_due: "2026-02-01" }],
      }),
    ]);

    expect(unverifiedTopics(data).map((item) => item.id)).toEqual(["missing-transfer", "unverified"]);
  });

  it("orders recent topics by last activity", () => {
    const data = projection([
      topic({ id: "old", title: "Old", last_activity: { kind: "session", id: "s-old", date: "2026-01-02" } }),
      topic({ id: "new", title: "New", last_activity: { kind: "evidence", id: "e-new", date: "2026-01-03" } }),
    ]);

    expect(recentTopics(data).map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("reports the exact capabilities requiring recall", () => {
    const item = topic({ current_freshness: [
      { capability: "explain", status: "due", last_validated_at: "2026-01-01", next_recall_due: "2026-01-08" },
      { capability: "transfer", status: "valid", last_validated_at: "2026-02-01", next_recall_due: "2026-03-01" },
      { capability: "apply", status: "unverified", last_validated_at: "2026-01-05", next_recall_due: "2026-01-12" },
    ] });
    expect(dueCapabilities(item).map((entry) => entry.capability)).toEqual(["explain", "apply"]);
  });
});
