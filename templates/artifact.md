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

The learning material itself: notes, quotes, a summary, exercises copied
in for reference. This body is canonical learning material but is never
exposed in the generated projection.
