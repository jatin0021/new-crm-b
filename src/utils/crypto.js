import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from APP_ENCRYPTION_KEY or a secure fallback for dev/test environments.
 */
function getEncryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || 'succeed_capital_crm_default_secure_encryption_key_32_bytes!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Returns base64 encoded string containing iv + tag + ciphertext.
 */
export function encryptText(text) {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Combine iv (12b) + tag (16b) + ciphertext
  const combined = Buffer.concat([
    iv,
    tag,
    Buffer.from(encrypted, 'hex')
  ]);

  return combined.toString('base64');
}

/**
 * Decrypts base64 encoded payload using AES-256-GCM.
 */
export function decryptText(encryptedBase64) {
  if (!encryptedBase64) return null;
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedBase64, 'base64');
    
    if (combined.length < IV_LENGTH + TAG_LENGTH) {
      return encryptedBase64; // Return raw if not valid encrypted payload format
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return original text or null
    return encryptedBase64;
  }
}
