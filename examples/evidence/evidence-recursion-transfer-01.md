---
schema_version: 1
id: evidence-recursion-transfer-01
topic_id: topic-recursion
session_id: session-recursion-03
date: 2025-01-12
capabilities:
  - transfer
validation_context: initial
ai_assessment: sufficient
ai_rationale: "Correctly applies the base-case/recursive-case framing to an unseen tree-counting problem."
user_approved: true
rubric_results:
  - criterion: "Applies the framing to a problem not covered in the source material"
    passed: true
---

Solved "count nodes in a binary tree" recursively: base case is a null
node returning 0, recursive case is 1 + left count + right count.
