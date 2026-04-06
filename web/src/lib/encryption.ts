// AES-256-GCM encryption for Founder's Space credentials vault
// Uses Web Crypto API (works in both Node.js and Edge runtime)

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 128; // 128-bit auth tag

function getEncryptionKey(): string {
  const key = process.env.FS_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("FS_ENCRYPTION_KEY must be set (min 32 chars)");
  }
  return key;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret).slice(0, 32),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export interface EncryptedData {
  encrypted: string; // hex-encoded ciphertext (includes GCM auth tag)
  iv: string; // hex-encoded IV
  authTag: string; // hex-encoded auth tag (extracted from ciphertext)
}

export async function encrypt(plaintext: string): Promise<EncryptedData> {
  const key = await deriveKey(getEncryptionKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );

  const cipherArray = new Uint8Array(cipherBuffer);
  // GCM appends the auth tag at the end of the ciphertext
  const tagStart = cipherArray.length - TAG_LENGTH / 8;
  const ciphertext = cipherArray.slice(0, tagStart);
  const authTag = cipherArray.slice(tagStart);

  return {
    encrypted: toHex(ciphertext.buffer),
    iv: toHex(iv.buffer),
    authTag: toHex(authTag.buffer),
  };
}

export async function decrypt(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string
): Promise<string> {
  const key = await deriveKey(getEncryptionKey());
  const iv = fromHex(ivHex);
  const ciphertext = fromHex(encryptedHex);
  const authTag = fromHex(authTagHex);

  // Reconstruct the full ciphertext with auth tag appended (GCM format)
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer, tagLength: TAG_LENGTH },
    key,
    combined.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}
