const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Decodes canonical, padded standard base64. Returns null for anything else. */
export function base64ToBytes(value: string): Uint8Array | null {
  if (!BASE64_PATTERN.test(value)) {
    return null;
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Reject non-canonical encodings (non-zero padding bits) so each envelope has one representation.
  if (bytesToBase64(bytes) !== value) {
    return null;
  }
  return bytes;
}
