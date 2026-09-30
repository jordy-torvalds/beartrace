import { z } from "zod";
import {
  ACTIVITY_KINDS,
  CAPABILITIES,
  SCHEMA_VERSION,
  SESSION_OUTCOMES,
  idSchema,
  isoDateSchema,
} from "./common.js";

const baseSessionFrontmatterSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    id: idSchema,
    topic_id: idSchema,
    date: isoDateSchema,
    activity_kinds: z.array(z.enum(ACTIVITY_KINDS)).min(1),
    outcome: z.enum(SESSION_OUTCOMES),
    source_artifact_ids: z.array(idSchema).optional(),
    evidence_ids: z.array(idSchema).optional(),
    tested_capabilities: z.array(z.enum(CAPABILITIES)).optional(),
  })
  .strict();

export const sessionFrontmatterSchema = baseSessionFrontmatterSchema.superRefine((data, ctx) => {
  const isRecall = data.activity_kinds.includes("recall_attempt");
  if (isRecall && (!data.tested_capabilities || data.tested_capabilities.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tested_capabilities"],
      message: "tested_capabilities is required for a recall_attempt",
    });
  }
  if (!isRecall && data.tested_capabilities !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tested_capabilities"],
      message: "tested_capabilities is only allowed for a recall_attempt",
    });
  }
  if (
    data.tested_capabilities &&
    new Set(data.tested_capabilities).size !== data.tested_capabilities.length
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tested_capabilities"],
      message: "tested_capabilities must not contain duplicates",
    });
  }
});

export type SessionFrontmatter = z.infer<typeof baseSessionFrontmatterSchema>;

export interface SessionRecord {
  kind: "session";
  path: string;
  frontmatter: SessionFrontmatter;
  body: string;
}
