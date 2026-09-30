---
schema_version: 1
id: evidence-sufficient-with-override
topic_id: topic-minimal
session_id: session-minimal
date: 2025-01-02
capabilities:
  - explain
validation_context: initial
ai_assessment: sufficient
ai_rationale: "AI judged the explanation complete."
user_approved: true
override_rationale: "This should not be allowed alongside a sufficient assessment."
rubric_results:
  - criterion: "Explains without notes"
    passed: true
---

Carries a meaningless override rationale despite a sufficient assessment.
