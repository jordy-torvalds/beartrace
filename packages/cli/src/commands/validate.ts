import { sortDiagnostics, validateRepository, type Diagnostic } from "@beartrace/domain";
import { loadRepository } from "../fs-loader.js";

export interface RecordCounts {
  topics: number;
  artifacts: number;
  sessions: number;
  evidence: number;
}

export interface ValidateResult {
  diagnostics: Diagnostic[];
  counts: RecordCounts;
}

export async function runValidate(root: string): Promise<ValidateResult> {
  const loaded = await loadRepository(root);
  const crossDiagnostics = validateRepository(loaded);
  const diagnostics = sortDiagnostics([...loaded.diagnostics, ...crossDiagnostics]);

  return {
    diagnostics,
    counts: {
      topics: loaded.topics.length,
      artifacts: loaded.artifacts.length,
      sessions: loaded.sessions.length,
      evidence: loaded.evidence.length,
    },
  };
}
