import type { TopicRecord } from "./schemas/topic.js";
import type { ArtifactRecord } from "./schemas/artifact.js";
import type { SessionRecord } from "./schemas/session.js";
import type { EvidenceRecord } from "./schemas/evidence.js";
import { diagnostic, DiagnosticCodes, sortDiagnostics, type Diagnostic } from "./errors.js";

export interface ParsedRepository {
  topics: TopicRecord[];
  artifacts: ArtifactRecord[];
  sessions: SessionRecord[];
  evidence: EvidenceRecord[];
}

function detectCycle(edges: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function visit(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      const state = color.get(next) ?? WHITE;
      if (state === GRAY) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if (state === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const node of edges.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

export function validateRepository(repo: ParsedRepository): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const allIds = new Map<string, string[]>();
  const record = (id: string, path: string) => {
    const existing = allIds.get(id);
    if (existing) existing.push(path);
    else allIds.set(id, [path]);
  };
  for (const t of repo.topics) record(t.frontmatter.id, t.path);
  for (const a of repo.artifacts) record(a.frontmatter.id, a.path);
  for (const s of repo.sessions) record(s.frontmatter.id, s.path);
  for (const e of repo.evidence) record(e.frontmatter.id, e.path);

  for (const [id, paths] of allIds) {
    if (paths.length > 1) {
      for (const path of paths) {
        diagnostics.push(
          diagnostic(DiagnosticCodes.DUPLICATE_ID, path, `duplicate stable id "${id}" also used at ${paths.filter((p) => p !== path).join(", ")}`),
        );
      }
    }
  }

  const topicById = new Map(repo.topics.map((t) => [t.frontmatter.id, t]));
  const artifactById = new Map(repo.artifacts.map((a) => [a.frontmatter.id, a]));
  const sessionById = new Map(repo.sessions.map((s) => [s.frontmatter.id, s]));
  const evidenceById = new Map(repo.evidence.map((e) => [e.frontmatter.id, e]));

  const unknownRef = (path: string, field: string, id: string) =>
    diagnostics.push(
      diagnostic(DiagnosticCodes.UNKNOWN_REFERENCE, path, `${field} references unknown id "${id}"`),
    );

  const selfRef = (path: string, field: string, id: string) =>
    diagnostics.push(
      diagnostic(DiagnosticCodes.SELF_REFERENCE, path, `${field} must not reference the record's own id "${id}"`),
    );

  // Topics: reference existence + self-reference
  for (const t of repo.topics) {
    const fm = t.frontmatter;
    const checkIds = (field: string, ids: string[] | undefined) => {
      for (const id of ids ?? []) {
        if (id === fm.id) selfRef(t.path, field, id);
        else if (!topicById.has(id)) unknownRef(t.path, field, id);
      }
    };
    checkIds("related_topic_ids", fm.related_topic_ids);
    checkIds("split_from", fm.split_from);
    checkIds("split_into", fm.split_into);
    checkIds("merged_from", fm.merged_from);
    if (fm.supersedes !== undefined) {
      if (fm.supersedes === fm.id) selfRef(t.path, "supersedes", fm.supersedes);
      else if (!topicById.has(fm.supersedes)) unknownRef(t.path, "supersedes", fm.supersedes);
    }
    if (fm.superseded_by !== undefined) {
      if (fm.superseded_by === fm.id) selfRef(t.path, "superseded_by", fm.superseded_by);
      else if (!topicById.has(fm.superseded_by)) unknownRef(t.path, "superseded_by", fm.superseded_by);
    }
    if (fm.merged_into !== undefined) {
      if (fm.merged_into === fm.id) selfRef(t.path, "merged_into", fm.merged_into);
      else if (!topicById.has(fm.merged_into)) unknownRef(t.path, "merged_into", fm.merged_into);
    }
  }

  // Artifacts: topic_ids must exist
  for (const a of repo.artifacts) {
    for (const id of a.frontmatter.topic_ids) {
      if (!topicById.has(id)) unknownRef(a.path, "topic_ids", id);
    }
  }

  // Sessions: topic_id, source_artifact_ids, evidence_ids must exist
  for (const s of repo.sessions) {
    const fm = s.frontmatter;
    if (!topicById.has(fm.topic_id)) unknownRef(s.path, "topic_id", fm.topic_id);
    for (const id of fm.source_artifact_ids ?? []) {
      const artifact = artifactById.get(id);
      if (!artifact) unknownRef(s.path, "source_artifact_ids", id);
      else if (!artifact.frontmatter.topic_ids.includes(fm.topic_id)) {
        diagnostics.push(diagnostic(DiagnosticCodes.TOPIC_MISMATCH, s.path, `source artifact "${id}" is not linked to topic "${fm.topic_id}"`));
      }
    }
    for (const id of fm.evidence_ids ?? []) {
      if (!evidenceById.has(id)) unknownRef(s.path, "evidence_ids", id);
    }
  }

  // Evidence: topic_id, session_id, corrects, supersedes must exist; topic mismatch; lineage consistency
  for (const e of repo.evidence) {
    const fm = e.frontmatter;
    if (!topicById.has(fm.topic_id)) unknownRef(e.path, "topic_id", fm.topic_id);
    const session = sessionById.get(fm.session_id);
    if (!session) {
      unknownRef(e.path, "session_id", fm.session_id);
    } else {
      if (session.frontmatter.outcome !== "promoted") {
        diagnostics.push(
          diagnostic(
            DiagnosticCodes.LINEAGE_INCONSISTENT,
            e.path,
            `evidence "${fm.id}" cannot originate from session "${fm.session_id}" with outcome "${session.frontmatter.outcome}"`,
          ),
        );
      }
      if (session.frontmatter.topic_id !== fm.topic_id) {
        diagnostics.push(
          diagnostic(
            DiagnosticCodes.TOPIC_MISMATCH,
            e.path,
            `evidence topic_id "${fm.topic_id}" does not match session "${fm.session_id}" topic_id "${session.frontmatter.topic_id}"`,
          ),
        );
      }
      if (session.frontmatter.evidence_ids !== undefined && !session.frontmatter.evidence_ids.includes(fm.id)) {
        diagnostics.push(
          diagnostic(
            DiagnosticCodes.LINEAGE_INCONSISTENT,
            e.path,
            `evidence "${fm.id}" references session "${fm.session_id}" but that session's evidence_ids does not list it`,
          ),
        );
      }
      if (fm.validation_context === "recall") {
        const tested = new Set(session.frontmatter.tested_capabilities ?? []);
        const outside = (fm.retested_capabilities ?? []).filter((capability) => !tested.has(capability));
        if (outside.length > 0) {
          diagnostics.push(diagnostic(DiagnosticCodes.LINEAGE_INCONSISTENT, e.path, `retested_capabilities must be a subset of session tested_capabilities (unexpected: ${outside.join(", ")})`));
        }
      }
    }
    if (fm.corrects !== undefined) {
      const corrected = evidenceById.get(fm.corrects);
      if (!corrected) unknownRef(e.path, "corrects", fm.corrects);
      else if (corrected.frontmatter.topic_id !== fm.topic_id) {
        diagnostics.push(diagnostic(DiagnosticCodes.TOPIC_MISMATCH, e.path, `corrects must reference Evidence for topic "${fm.topic_id}"`));
      }
    }
    if (fm.supersedes !== undefined) {
      const superseded = evidenceById.get(fm.supersedes);
      if (!superseded) unknownRef(e.path, "supersedes", fm.supersedes);
      else if (superseded.frontmatter.topic_id !== fm.topic_id) {
        diagnostics.push(diagnostic(DiagnosticCodes.TOPIC_MISMATCH, e.path, `supersedes must reference Evidence for topic "${fm.topic_id}"`));
      }
    }
  }

  // Session -> evidence lineage consistency (evidence_ids listed must point back to this session)
  for (const s of repo.sessions) {
    const fm = s.frontmatter;
    if (fm.evidence_ids === undefined) continue;
    if (fm.outcome !== "promoted" && fm.evidence_ids.length > 0) {
      diagnostics.push(
        diagnostic(
          DiagnosticCodes.LINEAGE_INCONSISTENT,
          s.path,
          `session with outcome "${fm.outcome}" must not list promoted evidence_ids`,
        ),
      );
    }
    for (const id of fm.evidence_ids) {
      const e = evidenceById.get(id);
      if (e && e.frontmatter.session_id !== fm.id) {
        diagnostics.push(
          diagnostic(
            DiagnosticCodes.LINEAGE_INCONSISTENT,
            s.path,
            `session "${fm.id}" lists evidence "${id}" but that evidence's session_id is "${e.frontmatter.session_id}"`,
          ),
        );
      }
    }
  }

  // Topic evolution edges always point from the older/source topic to the newer/result topic.
  const topicEdges = new Map<string, string[]>();
  for (const t of repo.topics) topicEdges.set(t.frontmatter.id, []);
  const addTopicEdge = (from: string, to: string) => topicEdges.get(from)?.push(to);
  for (const t of repo.topics) {
    const fm = t.frontmatter;
    if (fm.supersedes) addTopicEdge(fm.supersedes, fm.id);
    if (fm.superseded_by) addTopicEdge(fm.id, fm.superseded_by);
    for (const id of fm.split_into ?? []) addTopicEdge(fm.id, id);
    for (const id of fm.split_from ?? []) addTopicEdge(id, fm.id);
    if (fm.merged_into) addTopicEdge(fm.id, fm.merged_into);
    for (const id of fm.merged_from ?? []) addTopicEdge(id, fm.id);
  }
  const topicCycle = detectCycle(topicEdges);
  if (topicCycle) {
    const cyclePath = topicById.get(topicCycle[0]!)?.path ?? "";
    diagnostics.push(
      diagnostic(DiagnosticCodes.CYCLE, cyclePath, `topic lineage cycle detected: ${topicCycle.join(" -> ")}`),
    );
  }

  // Evidence correction/supersession cycles
  const evidenceEdges = new Map<string, string[]>();
  for (const e of repo.evidence) {
    const fm = e.frontmatter;
    const targets: string[] = [];
    if (fm.corrects) targets.push(fm.corrects);
    if (fm.supersedes) targets.push(fm.supersedes);
    evidenceEdges.set(fm.id, targets);
  }
  const evidenceCycle = detectCycle(evidenceEdges);
  if (evidenceCycle) {
    const cyclePath = evidenceById.get(evidenceCycle[0]!)?.path ?? "";
    diagnostics.push(
      diagnostic(DiagnosticCodes.CYCLE, cyclePath, `evidence correction/supersession cycle detected: ${evidenceCycle.join(" -> ")}`),
    );
  }

  return sortDiagnostics(diagnostics);
}
