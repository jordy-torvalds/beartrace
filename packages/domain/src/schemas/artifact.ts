import { z } from "zod";
import {
  ARTIFACT_KINDS,
  SCHEMA_VERSION,
  idSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  sourceDescriptorSchema,
} from "./common.js";

export const artifactAttachmentSchema = z
  .object({
    path: nonEmptyStringSchema,
    media_type: nonEmptyStringSchema,
  })
  .strict();

export type ArtifactAttachment = z.infer<typeof artifactAttachmentSchema>;

export const artifactFrontmatterSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    id: idSchema,
    kind: z.enum(ARTIFACT_KINDS),
    title: nonEmptyStringSchema,
    date: isoDateSchema,
    topic_ids: z.array(idSchema).min(1),
    source: sourceDescriptorSchema,
    attachments: z.array(artifactAttachmentSchema).optional(),
  })
  .strict();

export type ArtifactFrontmatter = z.infer<typeof artifactFrontmatterSchema>;

export interface ArtifactRecord {
  kind: "artifact";
  path: string;
  frontmatter: ArtifactFrontmatter;
  body: string;
  attachments?: ArtifactAttachmentRecord[];
}

export interface ArtifactAttachmentRecord extends ArtifactAttachment {
  content: string;
}
