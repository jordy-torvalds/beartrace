import { base64ToBytes } from "./base64.js";
import { EncryptionError } from "./errors.js";

export const ENVELOPE_VERSION = 1;
export const ALGORITHM = "AES-256-GCM";
export const KDF = "PBKDF2-SHA-256";
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;

/** OWASP (2023) recommendation for PBKDF2-HMAC-SHA-256. */
export const DEFAULT_ITERATIONS = 600_000;
/** Bounds accepted from untrusted envelopes: reject weak KDF settings and CPU-exhaustion values. */
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 10_000_000;

export interface EncryptedEnvelope {
  version: typeof ENVELOPE_VERSION;
  alg: typeof ALGORITHM;
  kdf: typeof KDF;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface DecodedEnvelope {
  envelope: EncryptedEnvelope;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

const ENVELOPE_KEYS = ["version", "alg", "kdf", "iterations", "salt", "iv", "ciphertext"] as const;

function invalid(reason: string): EncryptionError {
  return new EncryptionError("INVALID_ENVELOPE", `Invalid encrypted envelope: ${reason}`);
}

export function isValidIterations(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= MIN_ITERATIONS &&
    value <= MAX_ITERATIONS
  );
}

function decodeField(record: Record<string, unknown>, key: string): Uint8Array {
  const value = record[key];
  if (typeof value !== "string") {
    throw invalid(`"${key}" must be a base64 string`);
  }
  const bytes = base64ToBytes(value);
  if (bytes === null) {
    throw invalid(`"${key}" is not canonical base64`);
  }
  return bytes;
}

/**
 * Validates an already-parsed value against the strict v1 envelope schema and
 * decodes its binary fields. Unknown keys are rejected.
 */
export function decodeEnvelope(value: unknown): DecodedEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalid("expected a JSON object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const extra = keys.filter((key) => !(ENVELOPE_KEYS as readonly string[]).includes(key));
  if (extra.length > 0) {
    throw invalid("unexpected fields");
  }
  for (const key of ENVELOPE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      throw invalid(`missing "${key}"`);
    }
  }
  if (record.version !== ENVELOPE_VERSION) {
    throw invalid("unsupported version");
  }
  if (record.alg !== ALGORITHM) {
    throw invalid("unsupported algorithm");
  }
  if (record.kdf !== KDF) {
    throw invalid("unsupported KDF");
  }
  if (!isValidIterations(record.iterations)) {
    throw invalid(`"iterations" must be an integer between ${MIN_ITERATIONS} and ${MAX_ITERATIONS}`);
  }

  const salt = decodeField(record, "salt");
  const iv = decodeField(record, "iv");
  const ciphertext = decodeField(record, "ciphertext");
  if (salt.length !== SALT_BYTES) {
    throw invalid(`"salt" must be ${SALT_BYTES} bytes`);
  }
  if (iv.length !== IV_BYTES) {
    throw invalid(`"iv" must be ${IV_BYTES} bytes`);
  }
  if (ciphertext.length < GCM_TAG_BYTES) {
    throw invalid(`"ciphertext" is shorter than the authentication tag`);
  }

  const envelope: EncryptedEnvelope = {
    version: ENVELOPE_VERSION,
    alg: ALGORITHM,
    kdf: KDF,
    iterations: record.iterations,
    salt: record.salt as string,
    iv: record.iv as string,
    ciphertext: record.ciphertext as string,
  };
  return { envelope, salt, iv, ciphertext };
}

/** Validates an already-parsed value and returns a normalized envelope. */
export function validateEnvelope(value: unknown): EncryptedEnvelope {
  return decodeEnvelope(value).envelope;
}

/** Parses envelope JSON text and validates it. */
export function parseEnvelope(json: string): EncryptedEnvelope {
  if (typeof json !== "string") {
    throw invalid("expected JSON text");
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw invalid("not valid JSON");
  }
  return validateEnvelope(value);
}

export function serializeEnvelope(envelope: EncryptedEnvelope): string {
  const normalized = validateEnvelope(envelope);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

/**
 * Additional authenticated data binding the header metadata to the ciphertext,
 * so metadata edits are detected even where they would not change the key.
 */
export function envelopeAad(envelope: Pick<EncryptedEnvelope, "version" | "alg" | "kdf" | "iterations">): Uint8Array {
  const header = `beartrace-envelope|v${envelope.version}|${envelope.alg}|${envelope.kdf}|${envelope.iterations}`;
  return new TextEncoder().encode(header);
}
