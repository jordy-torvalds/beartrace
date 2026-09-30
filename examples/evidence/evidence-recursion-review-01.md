---
schema_version: 1
id: evidence-recursion-review-01
topic_id: topic-recursion
session_id: session-recursion-01
date: 2025-01-06
capabilities:
  - review
validation_context: initial
ai_assessment: sufficient
ai_rationale: "Trace correctly identifies every stack frame and the base case termination."
user_approved: true
rubric_results:
  - criterion: "Traces all stack frames for factorial(4) without error"
    passed: true
  - criterion: "Correctly identifies the base case"
    passed: true
---

Hand-drawn trace of `factorial(4)` showing all 5 stack frames (4,3,2,1,0)
and the unwind back to 24, base case correctly identified at n=0.
