import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRecord } from "./parse.js";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../../");

async function fixture(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

describe("parseRecord", () => {
  it("accepts a minimal valid topic fixture", async () => {
    const result = parseRecord("topic", "tests/fixtures/valid/topic.md", await fixture("tests/fixtures/valid/topic.md"));
    expect(result.ok).toBe(true);
  });

  it("rejects impossible dates, unknown fields, and missing required bodies", async () => {
    const badDate = parseRecord("topic", "tests/fixtures/invalid/topic-bad-date.md", await fixture("tests/fixtures/invalid/topic-bad-date.md"));
    const unknownField = parseRecord("topic", "tests/fixtures/invalid/topic-unknown-field.md", await fixture("tests/fixtures/invalid/topic-unknown-field.md"));
    const missingBody = parseRecord("artifact", "tests/fixtures/invalid/artifact-missing-body.md", await fixture("tests/fixtures/invalid/artifact-missing-body.md"));

    expect(badDate.ok).toBe(false);
    expect(unknownField.ok).toBe(false);
    expect(missingBody.ok).toBe(false);
  });

  it("enforces insufficient assessment override semantics", async () => {
    const noOverride = parseRecord(
      "evidence",
      "tests/fixtures/invalid/evidence-insufficient-no-override.md",
      await fixture("tests/fixtures/invalid/evidence-insufficient-no-override.md"),
    );
    const meaninglessOverride = parseRecord(
      "evidence",
      "tests/fixtures/invalid/evidence-sufficient-with-override.md",
      await fixture("tests/fixtures/invalid/evidence-sufficient-with-override.md"),
    );

    expect(noOverride.ok).toBe(false);
    expect(meaninglessOverride.ok).toBe(false);
  });
});
