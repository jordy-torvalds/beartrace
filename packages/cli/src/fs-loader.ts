import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  diagnostic,
  DiagnosticCodes,
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

function resolveAttachmentPath(root: string, attachmentPath: string): string | null {
  if (path.isAbsolute(attachmentPath)) return null;
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, attachmentPath);
  const relative = path.relative(rootPath, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

async function loadArtifactAttachments(root: string, artifact: ArtifactRecord, diagnostics: Diagnostic[]): Promise<void> {
  const attachments = artifact.frontmatter.attachments ?? [];
  if (attachments.length === 0) return;

  const rootPath = await realpath(root);

  const loaded = [];
  for (const attachment of attachments) {
    if (attachment.media_type !== "text/html") {
      diagnostics.push(
        diagnostic(
          DiagnosticCodes.ATTACHMENT_UNSUPPORTED,
          artifact.path,
          `attachment "${attachment.path}" uses unsupported media type "${attachment.media_type}"; only text/html is supported`,
        ),
      );
      continue;
    }

    const resolved = resolveAttachmentPath(rootPath, attachment.path);
    if (!resolved) {
      diagnostics.push(
        diagnostic(
          DiagnosticCodes.ATTACHMENT_PATH,
          artifact.path,
          `attachment path must stay inside the ledger root: "${attachment.path}"`,
        ),
      );
      continue;
    }

    try {
      const realResolved = await realpath(resolved);
      const relative = path.relative(rootPath, realResolved);
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        diagnostics.push(
          diagnostic(
            DiagnosticCodes.ATTACHMENT_PATH,
            artifact.path,
            `attachment path resolves outside the ledger root: "${attachment.path}"`,
          ),
        );
        continue;
      }
      const content = await readFile(realResolved, "utf8");
      loaded.push({ ...attachment, content });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      diagnostics.push(
        diagnostic(
          DiagnosticCodes.ATTACHMENT_MISSING,
          artifact.path,
          `unable to read attachment "${attachment.path}": ${detail}`,
        ),
      );
    }
  }
  if (loaded.length > 0) artifact.attachments = loaded;
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
      if (parsed.record.kind === "artifact") {
        await loadArtifactAttachments(root, parsed.record, result.diagnostics);
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
