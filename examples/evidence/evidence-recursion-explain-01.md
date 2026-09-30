---
schema_version: 1
id: evidence-recursion-explain-01
topic_id: topic-recursion
session_id: session-recursion-02
date: 2025-01-10
capabilities:
  - explain
validation_context: initial
ai_assessment: sufficient
ai_rationale: "Explanation distinguishes the call stack from a loop counter and covers unwind order correctly."
user_approved: true
rubric_results:
  - criterion: "Explains recursion without conflating it with iteration"
    passed: true
---

Explained to a peer, unprompted: each call pushes a new frame, the base
case stops the pushing, then frames pop and combine results on the way
back up.
