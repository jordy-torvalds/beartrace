---
schema_version: 1
id: evidence-retested-not-subset
topic_id: topic-minimal
session_id: session-minimal
date: 2025-02-01
capabilities:
  - explain
validation_context: recall
ai_assessment: sufficient
ai_rationale: "Delayed recall check."
user_approved: true
retested_capabilities:
  - explain
  - apply
rubric_results:
  - criterion: "Explains without notes"
    passed: true
---

`retested_capabilities` includes `apply`, which is not in `capabilities`.
