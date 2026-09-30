---
schema_version: 1
id: evidence-example-id
topic_id: topic-example-id
session_id: session-example-id
date: 2025-01-02
capabilities:
  - explain # one or more, no duplicates, of: review, explain, transfer, apply
validation_context: initial # one of: initial, recall, application, other
ai_assessment: sufficient # one of: sufficient, insufficient
ai_rationale: "Why the AI assessed the proof this way."
user_approved: true
rubric_results:
  - criterion: "Explains the core idea without notes"
    passed: true
    # notes: optional free-text
# override_rationale: required nonblank text, and only allowed, when ai_assessment is insufficient
# retested_capabilities: required nonempty subset of `capabilities`, and only allowed, when validation_context is recall
# corrects: evidence-id-being-corrected
# supersedes: evidence-id-being-superseded
---

The concise proof itself: what was said, written, or done that
demonstrates the named capabilities. Keep this focused — this is the
evidence, not a transcript of the whole session.
