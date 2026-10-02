import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildProjection } from "./commands/build-projection.js";
import { runValidate } from "./commands/validate.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

describe("CLI integration", () => {
  it("validates the example ledger", async () => {
    const result = await runValidate(path.join(repositoryRoot, "examples"));
    expect(result.diagnostics).toEqual([]);
    expect(result.counts.topics).toBeGreaterThan(0);
  });

  it("writes byte-identical deterministic projections and matching checksums", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "beartrace-"));
    const firstPath = path.join(outputDir, "first.json");
    const secondPath = path.join(outputDir, "second.json");
    const options = {
      root: path.join(repositoryRoot, "examples"),
      asOf: "2025-06-01",
      configPath: path.join(repositoryRoot, "config/beartrace.config.json"),
    };
    const first = await runBuildProjection({ ...options, outPath: firstPath });
    const second = await runBuildProjection({ ...options, outPath: secondPath });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.checksum).toBe(second.checksum);
    expect(await readFile(firstPath, "utf8")).toBe(await readFile(secondPath, "utf8"));
  });

  it("loads declared HTML attachments into the projection and rejects paths outside the ledger", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "beartrace-attachment-"));
    await mkdir(path.join(root, "topics"), { recursive: true });
    await mkdir(path.join(root, "artifacts/2026/01"), { recursive: true });
    await mkdir(path.join(root, "sources/2026/01"), { recursive: true });
    await writeFile(path.join(root, "topics/topic-a.md"), `---
schema_version: 1
id: topic-a
title: Topic A
created_at: 2026-01-01
purpose: Test purpose
key_questions:
  - What is Topic A?
validation_criteria:
  - Can explain Topic A
tags: []
---
`, "utf8");
    const markdownContent = "# Original Markdown\n";
    const pdfContent = Buffer.from("%PDF-1.7\n", "utf8");
    await writeFile(path.join(root, "sources/2026/01/report.md"), markdownContent, "utf8");
    await writeFile(path.join(root, "sources/2026/01/report.html"), "<!doctype html><title>Original</title>", "utf8");
    await writeFile(path.join(root, "sources/2026/01/report.pdf"), pdfContent);
    await writeFile(path.join(root, "artifacts/2026/01/report.md"), `---
schema_version: 1
id: report-a
kind: other
title: Report A
date: 2026-01-01
topic_ids:
  - topic-a
source:
  kind: other
  value: test
attachments:
  - path: sources/2026/01/report.md
    media_type: text/markdown
  - path: sources/2026/01/report.html
    media_type: text/html
  - path: sources/2026/01/report.pdf
    media_type: application/pdf
---
# Report A
`, "utf8");

    const result = await runBuildProjection({
      root,
      asOf: "2026-01-02",
      outPath: path.join(root, "projection.json"),
      configPath: path.join(repositoryRoot, "config/beartrace.config.json"),
    });
    expect(result.ok).toBe(true);
    expect(result.projection?.artifacts[0]?.attachments).toEqual([
      {
        path: "sources/2026/01/report.md",
        media_type: "text/markdown",
        content: markdownContent,
        encoding: "utf8",
        size_bytes: Buffer.byteLength(markdownContent),
      },
      {
        path: "sources/2026/01/report.html",
        media_type: "text/html",
        content: "<!doctype html><title>Original</title>",
        encoding: "utf8",
        size_bytes: Buffer.byteLength("<!doctype html><title>Original</title>"),
      },
      {
        path: "sources/2026/01/report.pdf",
        media_type: "application/pdf",
        content: pdfContent.toString("base64"),
        encoding: "base64",
        size_bytes: pdfContent.byteLength,
      },
    ]);

    await writeFile(path.join(root, "artifacts/2026/01/unsafe.md"), `---
schema_version: 1
id: unsafe-a
kind: other
title: Unsafe
date: 2026-01-01
topic_ids:
  - topic-a
source:
  kind: other
  value: test
attachments:
  - path: ../outside.html
    media_type: text/html
---
Unsafe
`, "utf8");
    const unsafe = await runValidate(root);
    expect(unsafe.diagnostics).toContainEqual(expect.objectContaining({
      code: "E_ATTACHMENT_PATH",
      path: "artifacts/2026/01/unsafe.md",
    }));
  });
});
