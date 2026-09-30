import matter from "gray-matter";
import yaml from "js-yaml";
import type { ZodError } from "zod";
import { topicFrontmatterSchema, type TopicRecord } from "./schemas/topic.js";
import { artifactFrontmatterSchema, type ArtifactRecord } from "./schemas/artifact.js";
import { sessionFrontmatterSchema, type SessionRecord } from "./schemas/session.js";
import { evidenceFrontmatterSchema, type EvidenceRecord } from "./schemas/evidence.js";
import { diagnostic, DiagnosticCodes, type Diagnostic } from "./errors.js";

export type RecordKind = "topic" | "artifact" | "session" | "evidence";

export type AnyRecord = TopicRecord | ArtifactRecord | SessionRecord | EvidenceRecord;

export interface ParseSuccess<T> {
  ok: true;
  record: T;
}

export interface ParseFailure {
  ok: false;
  diagnostics: Diagnostic[];
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const BODY_REQUIRED: Record<RecordKind, boolean> = {
  topic: false,
  artifact: true,
  session: true,
  evidence: true,
};

function zodErrorToDiagnostics(path: string, error: ZodError): Diagnostic[] {
  return error.issues.map((issue) => {
    const field = issue.path.join(".") || "(root)";
    return diagnostic(DiagnosticCodes.SCHEMA, path, `${field}: ${issue.message}`);
  });
}

function schemaFor(kind: RecordKind) {
  switch (kind) {
    case "topic":
      return topicFrontmatterSchema;
    case "artifact":
      return artifactFrontmatterSchema;
    case "session":
      return sessionFrontmatterSchema;
    case "evidence":
      return evidenceFrontmatterSchema;
  }
}

export function parseRecord(
  kind: RecordKind,
  path: string,
  rawContent: string,
): ParseResult<AnyRecord> {
  let data: Record<string, unknown>;
  let body: string;
  try {
    // js-yaml's default schema auto-converts unquoted ISO date scalars (e.g. 2025-01-01)
    // into native Date objects. Force JSON_SCHEMA so dates stay plain strings and our
    // own isoDateSchema is the single source of truth for date validation.
    const parsed = matter(rawContent, {
      engines: {
        yaml: (input: string) => yaml.load(input, { schema: yaml.JSON_SCHEMA }) as object,
      },
    });
    data = parsed.data as Record<string, unknown>;
    body = parsed.content.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      diagnostics: [diagnostic(DiagnosticCodes.MALFORMED_FRONTMATTER, path, message)],
    };
  }

  const schema = schemaFor(kind);
  const result = schema.safeParse(data);
  const diagnostics: Diagnostic[] = [];

  if (!result.success) {
    diagnostics.push(...zodErrorToDiagnostics(path, result.error));
  }

  if (BODY_REQUIRED[kind] && body.length === 0) {
    diagnostics.push(
      diagnostic(DiagnosticCodes.MISSING_BODY, path, `${kind} requires a nonempty Markdown body`),
    );
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    record: { kind, path, frontmatter: result.data, body } as AnyRecord,
  };
}
