import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITERATIONS,
  EncryptionError,
  MIN_ITERATIONS,
  decryptUtf8,
  encryptUtf8,
  parseEnvelope,
  serializeEnvelope,
  validateEnvelope,
  type EncryptedEnvelope,
} from "./index.js";
import { base64ToBytes, bytesToBase64 } from "./base64.js";

// Keep tests fast; the default iteration count is covered separately.
const FAST = { iterations: MIN_ITERATIONS };
const PASSPHRASE = "correct horse battery staple";
const PLAINTEXT = JSON.stringify({
  title: "곰의 발자국 🐻 — trace",
  notes: ["naïve café", "日本語", "emoji 👣✨"],
  nested: { amount: 42, secret: "super-secret-marker-7f3a" },
});

async function expectCode(promise: Promise<unknown>, code: string): Promise<EncryptionError> {
  const error = await promise.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(EncryptionError);
  expect((error as EncryptionError).code).toBe(code);
  return error as EncryptionError;
}

function flipByte(base64: string, index: number): string {
  const bytes = base64ToBytes(base64)!;
  bytes[index] = bytes[index]! ^ 0x01;
  return bytesToBase64(bytes);
}

describe("encryptUtf8 / decryptUtf8", () => {
  it("round trips Unicode JSON", async () => {
    const envelope = await encryptUtf8(PLAINTEXT, PASSPHRASE, FAST);
    expect(await decryptUtf8(envelope, PASSPHRASE)).toBe(PLAINTEXT);
    expect(JSON.parse(await decryptUtf8(serializeEnvelope(envelope), PASSPHRASE))).toEqual(
      JSON.parse(PLAINTEXT),
    );
  });

  it("uses the default iteration count, fresh salt/IV, and only metadata fields", async () => {
    const a = await encryptUtf8(PLAINTEXT, PASSPHRASE);
    const b = await encryptUtf8(PLAINTEXT, PASSPHRASE, FAST);
    expect(a.iterations).toBe(DEFAULT_ITERATIONS);
    expect(Object.keys(a).sort()).toEqual(
      ["alg", "ciphertext", "iterations", "iv", "kdf", "salt", "version"].sort(),
    );
    expect(a).toMatchObject({ version: 1, alg: "AES-256-GCM", kdf: "PBKDF2-SHA-256" });
    expect(base64ToBytes(a.salt)).toHaveLength(16);
    expect(base64ToBytes(a.iv)).toHaveLength(12);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(await decryptUtf8(a, PASSPHRASE)).toBe(PLAINTEXT);
  });

  it("rejects a wrong passphrase without leaking plaintext", async () => {
    const envelope = await encryptUtf8(PLAINTEXT, PASSPHRASE, FAST);
    const error = await expectCode(decryptUtf8(envelope, "wrong passphrase"), "DECRYPTION_FAILED");
    expect(error.message).not.toContain("super-secret-marker");
    expect(error.message).not.toContain(PASSPHRASE);
  });

  it("rejects tampered ciphertext, IV, salt, and metadata", async () => {
    const envelope = await encryptUtf8(PLAINTEXT, PASSPHRASE, FAST);
    const tampered: EncryptedEnvelope[] = [
      { ...envelope, ciphertext: flipByte(envelope.ciphertext, 0) },
      // Last byte lives in the GCM authentication tag.
      { ...envelope, ciphertext: flipByte(envelope.ciphertext, base64ToBytes(envelope.ciphertext)!.length - 1) },
      { ...envelope, iv: flipByte(envelope.iv, 0) },
      { ...envelope, salt: flipByte(envelope.salt, 0) },
      { ...envelope, iterations: envelope.iterations + 1 },
    ];
    for (const candidate of tampered) {
      const error = await expectCode(decryptUtf8(candidate, PASSPHRASE), "DECRYPTION_FAILED");
      expect(error.message).not.toContain("super-secret-marker");
    }
  });

  it("rejects empty passphrases", async () => {
    const envelope = await encryptUtf8(PLAINTEXT, PASSPHRASE, FAST);
    for (const passphrase of ["", "   ", undefined as unknown as string]) {
      await expectCode(encryptUtf8(PLAINTEXT, passphrase, FAST), "EMPTY_PASSPHRASE");
      await expectCode(decryptUtf8(envelope, passphrase), "EMPTY_PASSPHRASE");
    }
  });

  it("rejects out-of-range iteration options", async () => {
    await expectCode(encryptUtf8(PLAINTEXT, PASSPHRASE, { iterations: 1000 }), "INVALID_OPTIONS");
    await expectCode(encryptUtf8(PLAINTEXT, PASSPHRASE, { iterations: 1.5e5 + 0.5 }), "INVALID_OPTIONS");
  });

  it("produces ciphertext that does not contain the plaintext", async () => {
    const envelope = await encryptUtf8(PLAINTEXT, PASSPHRASE, FAST);
    const serialized = serializeEnvelope(envelope);
    const utf8Base64 = bytesToBase64(new TextEncoder().encode(PLAINTEXT));
    for (const needle of ["super-secret-marker-7f3a", "곰의", "secret", PASSPHRASE, utf8Base64.slice(0, 16)]) {
      expect(serialized).not.toContain(needle);
    }
    const ciphertextBytes = Buffer.from(base64ToBytes(envelope.ciphertext)!).toString("latin1");
    expect(ciphertextBytes).not.toContain("super-secret-marker-7f3a");
  });
});

describe("parseEnvelope / validateEnvelope", () => {
  async function validEnvelope(): Promise<EncryptedEnvelope> {
    return encryptUtf8("hello", PASSPHRASE, FAST);
  }

  it("accepts a serialized envelope", async () => {
    const envelope = await validEnvelope();
    expect(parseEnvelope(serializeEnvelope(envelope))).toEqual(envelope);
  });

  it("rejects malformed envelopes", async () => {
    const good = await validEnvelope();
    const { ciphertext: _omit, ...missingCiphertext } = good;
    const cases: unknown[] = [
      null,
      42,
      "string",
      [],
      {},
      missingCiphertext,
      { ...good, extra: "field" },
      { ...good, plaintext: "leak" },
      { ...good, version: 2 },
      { ...good, version: "1" },
      { ...good, alg: "AES-128-GCM" },
      { ...good, kdf: "scrypt" },
      { ...good, iterations: 1 },
      { ...good, iterations: 1e12 },
      { ...good, iterations: 150000.5 },
      { ...good, iterations: "600000" },
      { ...good, salt: "not base64!" },
      { ...good, salt: bytesToBase64(new Uint8Array(8)) },
      { ...good, iv: bytesToBase64(new Uint8Array(16)) },
      { ...good, iv: 123 },
      { ...good, ciphertext: bytesToBase64(new Uint8Array(4)) },
      { ...good, ciphertext: good.ciphertext.replace(/=+$/, "") + "A" },
    ];
    for (const value of cases) {
      expect(() => validateEnvelope(value), JSON.stringify(value)).toThrowError(EncryptionError);
      try {
        validateEnvelope(value);
      } catch (error) {
        expect((error as EncryptionError).code).toBe("INVALID_ENVELOPE");
      }
    }
    for (const text of ["", "{", "not json", "[1,2]", "null"]) {
      expect(() => parseEnvelope(text)).toThrowError(EncryptionError);
    }
    await expectCode(decryptUtf8("{not json", PASSPHRASE), "INVALID_ENVELOPE");
    await expectCode(
      decryptUtf8({ ...good, alg: "none" } as unknown as EncryptedEnvelope, PASSPHRASE),
      "INVALID_ENVELOPE",
    );
  });
});
