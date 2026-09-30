import { z } from "zod";
import {
  AI_ASSESSMENTS,
  CAPABILITIES,
  SCHEMA_VERSION,
  VALIDATION_CONTEXTS,
  idSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  rubricResultSchema,
} from "./common.js";

const baseEvidenceFrontmatterSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    id: idSchema,
    topic_id: idSchema,
    session_id: idSchema,
    date: isoDateSchema,
    capabilities: z
      .array(z.enum(CAPABILITIES))
      .min(1)
      .refine((values) => new Set(values).size === values.length, {
        message: "capabilities must not contain duplicates",
      }),
    validation_context: z.enum(VALIDATION_CONTEXTS),
    ai_assessment: z.enum(AI_ASSESSMENTS),
    ai_rationale: nonEmptyStringSchema,
    user_approved: z.literal(true),
    rubric_results: z.array(rubricResultSchema).min(1),
    override_rationale: nonEmptyStringSchema.optional(),
    retested_capabilities: z.array(z.enum(CAPABILITIES)).optional(),
    corrects: idSchema.optional(),
    supersedes: idSchema.optional(),
  })
  .strict();

// Cross-field rules that the base object schema cannot express with .strict() alone:
// - insufficient assessments require a nonblank override rationale; sufficient ones must not carry one
// - validation_context "recall" requires a nonempty retested_capabilities subset of capabilities
export const evidenceFrontmatterSchema = baseEvidenceFrontmatterSchema.superRefine((data, ctx) => {
  if (data.ai_assessment === "insufficient" && !data.override_rationale) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["override_rationale"],
      message: "override_rationale is required and must be nonblank when ai_assessment is insufficient",
    });
  }
  if (data.ai_assessment === "sufficient" && data.override_rationale !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["override_rationale"],
      message: "override_rationale must not be present when ai_assessment is sufficient",
    });
  }

  if (data.validation_context === "recall") {
    if (!data.retested_capabilities || data.retested_capabilities.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retested_capabilities"],
        message: "retested_capabilities is required and must be nonempty when validation_context is recall",
      });
    } else {
      const capabilitySet = new Set(data.capabilities);
      const unknown = data.retested_capabilities.filter((c) => !capabilitySet.has(c));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["retested_capabilities"],
          message: `retested_capabilities must be a subset of capabilities (unexpected: ${unknown.join(", ")})`,
        });
      }
      if (new Set(data.retested_capabilities).size !== data.retested_capabilities.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["retested_capabilities"],
          message: "retested_capabilities must not contain duplicates",
        });
      }
    }
  } else if (data.retested_capabilities !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["retested_capabilities"],
      message: "retested_capabilities is only allowed when validation_context is recall",
    });
  }

  if (data.corrects !== undefined && data.corrects === data.id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["corrects"],
      message: "corrects must not reference the evidence itself",
    });
  }
  if (data.supersedes !== undefined && data.supersedes === data.id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supersedes"],
      message: "supersedes must not reference the evidence itself",
    });
  }
});

export type EvidenceFrontmatter = z.infer<typeof baseEvidenceFrontmatterSchema>;

export interface EvidenceRecord {
  kind: "evidence";
  path: string;
  frontmatter: EvidenceFrontmatter;
  body: string;
}

export function isValidEvidence(evidence: EvidenceFrontmatter): boolean {
  if (!evidence.user_approved) return false;
  if (evidence.ai_assessment === "sufficient") return true;
  return Boolean(evidence.override_rationale && evidence.override_rationale.trim().length > 0);
}
