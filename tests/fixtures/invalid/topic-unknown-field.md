---
schema_version: 1
id: topic-unknown-field
title: "Has an unknown field"
created_at: 2025-01-01
purpose: "Exercise unknown-field rejection."
key_questions:
  - "Does validation reject unknown fields?"
validation_criteria:
  - "Yes."
unexpected_extra_field: "should be rejected"
---

Has an unknown frontmatter field.
