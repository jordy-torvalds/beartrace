import { z } from "zod";
import { SCHEMA_VERSION } from "./common.js";
import { idSchema, isoDateSchema, nonEmptyStringSchema } from "./common.js";

export const topicFrontmatterSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    id: idSchema,
    title: nonEmptyStringSchema,
    created_at: isoDateSchema,
    purpose: nonEmptyStringSchema,
    key_questions: z.array(nonEmptyStringSchema).min(1),
    validation_criteria: z.array(nonEmptyStringSchema).min(1),
    tags: z.array(nonEmptyStringSchema).optional(),
    related_topic_ids: z.array(idSchema).optional(),
    supersedes: idSchema.optional(),
    superseded_by: idSchema.optional(),
    split_from: z.array(idSchema).optional(),
    split_into: z.array(idSchema).optional(),
    merged_from: z.array(idSchema).optional(),
    merged_into: idSchema.optional(),
  })
  .strict();

export type TopicFrontmatter = z.infer<typeof topicFrontmatterSchema>;

export interface TopicRecord {
  kind: "topic";
  path: string;
  frontmatter: TopicFrontmatter;
  body: string;
}
