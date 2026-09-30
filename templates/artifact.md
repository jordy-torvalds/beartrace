---
schema_version: 1
id: artifact-example-id
kind: article # one of: article, book, video, course, paper, documentation, talk, exercise, other
title: "Title of the material"
date: 2025-01-01
topic_ids:
  - topic-example-id
source:
  kind: url # one of: url, isbn, doi, citation, internal, other
  value: "https://example.com/the-thing"
  # note: optional free-text note about the source
---

The learning material itself: a report, notes, summary, or exercises.
This body is included in the encrypted dashboard Projection so it can be
read in the report library. Do not store secrets or confidential material.
