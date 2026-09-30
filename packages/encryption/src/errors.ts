export type EncryptionErrorCode =
  | "EMPTY_PASSPHRASE"
  | "INVALID_OPTIONS"
  | "INVALID_ENVELOPE"
  | "DECRYPTION_FAILED";

/**
 * Error raised by the encryption package. Messages are fixed strings and never
 * include the passphrase, plaintext, or key material.
 */
export class EncryptionError extends Error {
  readonly code: EncryptionErrorCode;

  constructor(code: EncryptionErrorCode, message: string) {
    super(message);
    this.name = "EncryptionError";
    this.code = code;
  }
}
