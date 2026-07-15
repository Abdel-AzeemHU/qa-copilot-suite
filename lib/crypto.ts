import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

// AES-256-GCM encryption for storing user API keys at rest.
// The encryption key is derived from process.env.ENCRYPTION_KEY (server-side
// secret). Never hardcode keys; never log plaintext keys.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
// Historical salt — MUST stay "qa-copilot-suite" even after the Qaera rebrand,
// or every already-encrypted API key becomes undecryptable.
const SALT = "qa-copilot-suite:apikey:v1";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY env var is missing or too short (min 16 chars). See .env.local.example.",
    );
  }
  // Derive a 32-byte key deterministically from the secret.
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypts a plaintext string. Returns a compact string of the form
 * `iv:authTag:ciphertext`, all hex-encoded.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a string produced by {@link encrypt}.
 */
export function decrypt(payload: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
