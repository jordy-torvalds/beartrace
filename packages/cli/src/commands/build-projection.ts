import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildProjection,
  canonicalJsonStringify,
  configSchema,
  DEFAULT_CONFIG,
  sortDiagnostics,
  validateRepository,
  type BearTraceConfig,
  type Diagnostic,
  type Projection,
  isoDateSchema,
} from "@beartrace/domain";
import { loadRepository } from "../fs-loader.js";
import type { RecordCounts } from "./validate.js";

export interface BuildProjectionOptions {
  root: string;
  asOf: string;
  outPath: string;
  configPath?: string;
}

export interface BuildProjectionResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  outputPath?: string;
  checksum?: string;
  counts?: RecordCounts;
  projection?: Projection;
}

export async function loadConfig(configPath: string | undefined): Promise<BearTraceConfig> {
  if (!configPath) return DEFAULT_CONFIG;
  const raw = await readFile(configPath, "utf8");
  return configSchema.parse(JSON.parse(raw));
}

export async function runBuildProjection(options: BuildProjectionOptions): Promise<BuildProjectionResult> {
  isoDateSchema.parse(options.asOf);
  const loaded = await loadRepository(options.root);
  const crossDiagnostics = validateRepository(loaded);
  const diagnostics = sortDiagnostics([...loaded.diagnostics, ...crossDiagnostics]);

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const config = await loadConfig(options.configPath);
  const projection = buildProjection(loaded, config, options.asOf);
  const json = canonicalJsonStringify(projection);

  await mkdir(path.dirname(options.outPath), { recursive: true });
  const output = `${json}\n`;
  await writeFile(options.outPath, output, "utf8");

  const checksum = crypto.createHash("sha256").update(output).digest("hex");

  return {
    ok: true,
    diagnostics: [],
    outputPath: options.outPath,
    checksum,
    projection,
    counts: {
      topics: loaded.topics.length,
      artifacts: loaded.artifacts.length,
      sessions: loaded.sessions.length,
      evidence: loaded.evidence.length,
    },
  };
}
