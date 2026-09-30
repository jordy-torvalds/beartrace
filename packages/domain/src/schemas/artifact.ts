import { z } from "zod";
import {
  ARTIFACT_KINDS,
  SCHEMA_VERSION,
  idSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  sourceDescriptorSchema,
} from "./common.js";

export const artifactFrontmatterSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    id: idSchema,
    kind: z.enum(ARTIFACT_KINDS),
    title: nonEmptyStringSchema,
    date: isoDateSchema,
    topic_ids: z.array(idSchema).min(1),
    source: sourceDescriptorSchema,
  })
  .strict();

export type ArtifactFrontmatter = z.infer<typeof artifactFrontmatterSchema>;

export interface ArtifactRecord {
  kind: "artifact";
  path: string;
  frontmatter: ArtifactFrontmatter;
  body: string;
}
