import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseRecord,
  sortDiagnostics,
  type ArtifactRecord,
  type Diagnostic,
  type EvidenceRecord,
  type RecordKind,
  type SessionRecord,
  type TopicRecord,
} from "@beartrace/domain";

const TYPE_DIRS: Record<RecordKind, string> = {
  topic: "topics",
  artifact: "artifacts",
  session: "sessions",
  evidence: "evidence",
};

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files.sort();
}

function toRepoRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export interface LoadedRepository {
  topics: TopicRecord[];
  artifacts: ArtifactRecord[];
  sessions: SessionRecord[];
  evidence: EvidenceRecord[];
  diagnostics: Diagnostic[];
}

export async function loadRepository(root: string): Promise<LoadedRepository> {
  const result: LoadedRepository = {
    topics: [],
    artifacts: [],
    sessions: [],
    evidence: [],
    diagnostics: [],
  };

  for (const kind of Object.keys(TYPE_DIRS) as RecordKind[]) {
    const dir = path.join(root, TYPE_DIRS[kind]);
    const files = await walkMarkdownFiles(dir);
    for (const file of files) {
      const raw = await readFile(file, "utf8");
      const relPath = toRepoRelativePath(root, file);
      const parsed = parseRecord(kind, relPath, raw);
      if (!parsed.ok) {
        result.diagnostics.push(...parsed.diagnostics);
        continue;
      }
      switch (parsed.record.kind) {
        case "topic":
          result.topics.push(parsed.record);
          break;
        case "artifact":
          result.artifacts.push(parsed.record);
          break;
        case "session":
          result.sessions.push(parsed.record);
          break;
        case "evidence":
          result.evidence.push(parsed.record);
          break;
      }
    }
  }

  result.diagnostics = sortDiagnostics(result.diagnostics);
  return result;
}
