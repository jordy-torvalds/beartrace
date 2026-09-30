import { z } from "zod";
import { SCHEMA_VERSION } from "./common.js";

export const configSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    recall_intervals_days: z
      .array(z.number().int().positive())
      .min(1)
      .refine((values) => new Set(values).size === values.length, {
        message: "recall_intervals_days must not contain duplicates",
      })
      .refine((values) => values.every((v, i) => i === 0 || v > values[i - 1]!), {
        message: "recall_intervals_days must be strictly ascending",
      }),
  })
  .strict();

export type BearTraceConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: BearTraceConfig = {
  schema_version: SCHEMA_VERSION,
  recall_intervals_days: [7, 30, 90],
};
