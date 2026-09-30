export interface Diagnostic {
  code: string;
  path: string;
  message: string;
}

export const DiagnosticCodes = {
  MALFORMED_FRONTMATTER: "E_MALFORMED_FRONTMATTER",
  SCHEMA: "E_SCHEMA",
  MISSING_BODY: "E_MISSING_BODY",
  DUPLICATE_ID: "E_DUPLICATE_ID",
  UNKNOWN_REFERENCE: "E_UNKNOWN_REFERENCE",
  TOPIC_MISMATCH: "E_TOPIC_MISMATCH",
  LINEAGE_INCONSISTENT: "E_LINEAGE_INCONSISTENT",
  SELF_REFERENCE: "E_SELF_REFERENCE",
  CYCLE: "E_CYCLE",
} as const;

export function diagnostic(code: string, path: string, message: string): Diagnostic {
  return { code, path, message };
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });
}
