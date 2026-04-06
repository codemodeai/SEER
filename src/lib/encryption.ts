// AES-256-GCM encryption for Founder's Space credentials vault (MCP server)
// Uses Node.js crypto module

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM

function getEncryptionKey(): Buffer {
  const key = process.env["FS_ENCRYPTION_KEY"];
  if (!key || key.length < 32) {
    throw new Error("FS_ENCRYPTION_KEY must be set (min 32 chars)");
  }
  // Use first 32 bytes as the key
  return Buffer.from(key.slice(0, 32), "utf-8");
}

export interface EncryptedData {
  encrypted: string; // hex-encoded ciphertext
  iv: string; // hex-encoded IV
  authTag: string; // hex-encoded auth tag
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

export function decrypt(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string
): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}
