// Credential encryption using Web Crypto API (AES-GCM 256-bit).
// Key is derived from a static salt + hostname via PBKDF2.
// Credentials stored in localStorage as: "ENC:<base64(iv + ciphertext)>"

const MASTER_SALT = "freia-integrations-v1";
const ENC_PREFIX = "ENC:";

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(MASTER_SALT),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(typeof window !== "undefined" ? window.location.hostname : "localhost"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Combine iv (12 bytes) + ciphertext into a single Uint8Array
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return ENC_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decryptCredential(encrypted: string): Promise<string> {
  if (!encrypted || !encrypted.startsWith(ENC_PREFIX)) return encrypted;
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encrypted.slice(ENC_PREFIX.length)), (c) =>
      c.charCodeAt(0)
    );
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed (wrong key / corrupted data) — return as-is
    return encrypted;
  }
}
