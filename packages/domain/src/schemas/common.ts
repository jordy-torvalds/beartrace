import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const CAPABILITIES = ["review", "explain", "transfer", "apply"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const VALIDATION_CONTEXTS = ["initial", "recall", "application", "other"] as const;
export type ValidationContext = (typeof VALIDATION_CONTEXTS)[number];

export const AI_ASSESSMENTS = ["sufficient", "insufficient"] as const;
export type AiAssessment = (typeof AI_ASSESSMENTS)[number];

export const SESSION_OUTCOMES = ["in_progress", "promoted", "rejected", "abandoned"] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export const ACTIVITY_KINDS = [
  "read",
  "practice",
  "recall_attempt",
  "discussion",
  "review",
  "other",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ARTIFACT_KINDS = [
  "article",
  "book",
  "video",
  "course",
  "paper",
  "documentation",
  "talk",
  "exercise",
  "other",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const SOURCE_KINDS = ["url", "isbn", "doi", "citation", "internal", "other"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

// Stable IDs are immutable once assigned; keep the alphabet small and unambiguous.
export const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "id must be lowercase kebab-case starting with a letter")
  .min(3)
  .max(80);

// ISO calendar date (YYYY-MM-DD). Rejects impossible calendar dates (e.g. 2024-02-30)
// by round-tripping through Date.UTC instead of trusting the regex alone.
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be an ISO calendar date (YYYY-MM-DD)")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "date must be a real calendar date");

export const nonEmptyStringSchema = z.string().trim().min(1, "must not be blank");

export const sourceDescriptorSchema = z
  .object({
    kind: z.enum(SOURCE_KINDS),
    value: nonEmptyStringSchema,
    note: nonEmptyStringSchema.optional(),
  })
  .strict();

export const rubricResultSchema = z
  .object({
    criterion: nonEmptyStringSchema,
    passed: z.boolean(),
    notes: nonEmptyStringSchema.optional(),
  })
  .strict();

export function uniqueArray<T>(label: string) {
  return (values: T[]) => new Set(values).size === values.length;
}
