---
schema_version: 1
id: session-example-id
topic_id: topic-example-id
date: 2025-01-02
activity_kinds:
  - read # one or more of: read, practice, recall_attempt, discussion, review, other
outcome: in_progress # one of: in_progress, promoted, rejected, abandoned
# tested_capabilities: [explain] # required only for recall_attempt; records what was actually tested
source_artifact_ids:
  - artifact-example-id
# evidence_ids: [] # filled in once Evidence records are produced from this session
---

What you attempted, what confused you, mistakes made, corrections received,
and feedback. A Learning Session never grants capability by itself — it is
the record of the attempt, not the proof.
