// Type-only import: erased at runtime, so the module stays browser-compatible.
import type { webcrypto } from "node:crypto";
import { bytesToBase64 } from "./base64.js";
import {
  ALGORITHM,
  DEFAULT_ITERATIONS,
  ENVELOPE_VERSION,
  IV_BYTES,
  KDF,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  SALT_BYTES,
  decodeEnvelope,
  envelopeAad,
  isValidIterations,
  parseEnvelope,
  type EncryptedEnvelope,
} from "./envelope.js";
import { EncryptionError } from "./errors.js";

type SubtleCrypto = webcrypto.SubtleCrypto;
type CryptoKey = webcrypto.CryptoKey;
type KeyUsage = webcrypto.KeyUsage;

export interface EncryptOptions {
  /** PBKDF2 iteration count. Defaults to DEFAULT_ITERATIONS. */
  iterations?: number;
}

function subtle(): SubtleCrypto {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available in this environment");
  }
  return webCrypto.subtle;
}

function assertPassphrase(passphrase: unknown): asserts passphrase is string {
  if (typeof passphrase !== "string" || passphrase.trim().length === 0) {
    throw new EncryptionError("EMPTY_PASSPHRASE", "Passphrase must be a non-empty string");
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const baseKey = await subtle().importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/** Encrypts UTF-8 text with a passphrase and returns a v1 envelope. */
export async function encryptUtf8(
  plaintext: string,
  passphrase: string,
  options: EncryptOptions = {},
): Promise<EncryptedEnvelope> {
  if (typeof plaintext !== "string") {
    throw new EncryptionError("INVALID_OPTIONS", "Plaintext must be a string");
  }
  assertPassphrase(passphrase);
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  if (!isValidIterations(iterations)) {
    throw new EncryptionError(
      "INVALID_OPTIONS",
      `Iterations must be an integer between ${MIN_ITERATIONS} and ${MAX_ITERATIONS}`,
    );
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = { version: ENVELOPE_VERSION, alg: ALGORITHM, kdf: KDF, iterations } as const;

  const key = await deriveKey(passphrase, salt, iterations, "encrypt");
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv, additionalData: envelopeAad(header), tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    ...header,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypts a v1 envelope (object or JSON text). Wrong passphrases and any
 * tampering reject with a generic DECRYPTION_FAILED error.
 */
export async function decryptUtf8(
  envelope: EncryptedEnvelope | string,
  passphrase: string,
): Promise<string> {
  assertPassphrase(passphrase);
  const decoded = decodeEnvelope(typeof envelope === "string" ? parseEnvelope(envelope) : envelope);

  let plaintext: ArrayBuffer;
  try {
    const key = await deriveKey(passphrase, decoded.salt, decoded.envelope.iterations, "decrypt");
    plaintext = await subtle().decrypt(
      {
        name: "AES-GCM",
        iv: decoded.iv,
        additionalData: envelopeAad(decoded.envelope),
        tagLength: 128,
      },
      key,
      decoded.ciphertext,
    );
  } catch {
    throw new EncryptionError(
      "DECRYPTION_FAILED",
      "Decryption failed: wrong passphrase or corrupted data",
    );
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    throw new EncryptionError("DECRYPTION_FAILED", "Decryption failed: plaintext is not valid UTF-8");
  }
}
