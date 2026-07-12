import crypto from 'crypto';

let cachedMasterKey = null;

function getMasterKey() {
  if (cachedMasterKey) return cachedMasterKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('DATA_ENCRYPTION_KEY is not set.');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be base64 for exactly 32 bytes (e.g. `openssl rand -base64 32`).');
  }
  cachedMasterKey = buf;
  return cachedMasterKey;
}

// Derives a unique key per user from the master key, so no two users' rows
// are encrypted under the same key and a leaked row can't be decrypted
// without both the master key and the corresponding user id.
function deriveUserKey(userId) {
  return Buffer.from(crypto.hkdfSync('sha256', getMasterKey(), Buffer.alloc(0), Buffer.from(String(userId)), 32));
}

export function encryptForUser(userId, plaintextObj) {
  const key = deriveUserKey(userId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(plaintextObj), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptForUser(userId, { ciphertext, iv, authTag }) {
  const key = deriveUserKey(userId);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

// Called once at boot so a missing/malformed key fails fast instead of on
// the first user request.
export function assertEncryptionConfigured() {
  getMasterKey();
}
