import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runBuildProjection } from "./commands/build-projection.js";
import { runValidate } from "./commands/validate.js";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../../");

describe("CLI command adapters", () => {
  it("validates the example ledger", async () => {
    const result = await runValidate(path.join(repoRoot, "examples"));
    expect(result.diagnostics).toEqual([]);
    expect(result.counts.topics).toBeGreaterThan(0);
  });

  it("reports repository-relative duplicate id diagnostics", async () => {
    const result = await runValidate(path.join(repoRoot, "tests/fixtures/repos/duplicate-id"));
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      "topics/topic-one.md",
      "topics/topic-two.md",
    ]);
    expect(result.diagnostics.every((diagnostic) => diagnostic.code === "E_DUPLICATE_ID")).toBe(true);
  });

  it("writes deterministic projection bytes and checksum", async () => {
    const outPath = path.join(repoRoot, "dist/test-projection.json");
    const first = await runBuildProjection({
      root: path.join(repoRoot, "examples"),
      asOf: "2025-06-01",
      outPath,
      configPath: path.join(repoRoot, "config/beartrace.config.json"),
    });
    const firstBytes = await readFile(outPath, "utf8");
    const second = await runBuildProjection({
      root: path.join(repoRoot, "examples"),
      asOf: "2025-06-01",
      outPath,
      configPath: path.join(repoRoot, "config/beartrace.config.json"),
    });
    const secondBytes = await readFile(outPath, "utf8");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(secondBytes).toBe(firstBytes);
    expect(second.checksum).toBe(first.checksum);
  });
});
