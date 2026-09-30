import { mkdtemp, readFile } from "node:fs/promises";
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
});
