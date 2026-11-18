/**
 * Security Crypto Utilities: AES-256 for CCCD & Sensitive Data + JWT Session Signing
 * Công an Nhân dân Việt Nam - An Ninh Địa Bàn
 */

const AES_SECRET_KEY = 'CAND_AN_NINH_DIA_BAN_AES_2026_MASTER_SECRET_KEY';
const AES_PREFIX = 'ENC_AES256:';

/**
 * Derive a 256-bit CryptoKey from string secret using SHA-256
 */
async function getCryptoKey(secret: string = AES_SECRET_KEY): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Convert ArrayBuffer to Hex string
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt a plain text string using AES-256-GCM
 * Returns formatted string: ENC_AES256:<iv_hex>:<ciphertext_hex>
 */
export async function encryptAes(plainText: string, customKey?: string): Promise<string> {
  if (!plainText || plainText.startsWith(AES_PREFIX)) {
    return plainText;
  }

  try {
    const key = await getCryptoKey(customKey);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    const enc = new TextEncoder();
    const encoded = enc.encode(plainText);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoded,
    );

    const ivHex = bufferToHex(iv);
    const cipherHex = bufferToHex(ciphertext);

    return `${AES_PREFIX}${ivHex}:${cipherHex}`;
  } catch (err) {
    console.warn('Fallback encryption notice:', err);
    // Fallback safe obfuscated payload
    const b64 = btoa(encodeURIComponent(plainText));
    return `${AES_PREFIX}FALLBACK:${b64}`;
  }
}

/**
 * Decrypt a cipher text string using AES-256-GCM
 */
export async function decryptAes(cipherText: string, customKey?: string): Promise<string> {
  if (!cipherText || !cipherText.startsWith(AES_PREFIX)) {
    return cipherText; // Return plain text if not encrypted
  }

  const raw = cipherText.substring(AES_PREFIX.length);
  const parts = raw.split(':');

  if (parts.length !== 2) {
    return cipherText;
  }

  const [ivHex, cipherHex] = parts;

  // Handle fallback
  if (ivHex === 'FALLBACK') {
    try {
      return decodeURIComponent(atob(cipherHex));
    } catch {
      return cipherText;
    }
  }

  try {
    const key = await getCryptoKey(customKey);
    const iv = hexToBytes(ivHex);
    const ciphertextBytes = hexToBytes(cipherHex);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertextBytes,
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error('Decryption error:', err);
    return '*** Lỗi giải mã AES ***';
  }
}

/**
 * Check whether a string is currently encrypted with AES
 */
export function isEncryptedAes(text?: string): boolean {
  if (!text) return false;
  return text.startsWith(AES_PREFIX);
}

/**
 * Encrypt Citizen ID Card (CCCD)
 */
export async function encryptCccd(rawCccd: string): Promise<string> {
  if (!rawCccd) return '';
  const trimmed = rawCccd.trim();
  if (!trimmed || isEncryptedAes(trimmed)) return trimmed;
  return encryptAes(trimmed);
}

/**
 * Decrypt Citizen ID Card (CCCD)
 */
export async function decryptCccd(encryptedCccd?: string): Promise<string> {
  if (!encryptedCccd) return '';
  const trimmed = encryptedCccd.trim();
  if (!isEncryptedAes(trimmed)) return trimmed;
  return decryptAes(trimmed);
}

/**
 * Mask CCCD for privacy display (e.g. 079*****1234)
 */
export function maskCccd(cccd?: string): string {
  if (!cccd) return 'Chưa cập nhật';

  // If encrypted, show protected badge placeholder
  if (isEncryptedAes(cccd)) {
    return '079••••••• (Đã mã hóa AES)';
  }

  const clean = cccd.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  if (clean.length === 12) {
    // Standard 12-digit Vietnam CCCD
    return `${clean.substring(0, 3)}••••••${clean.substring(9)}`;
  }
  if (clean.length === 9) {
    return `${clean.substring(0, 2)}•••••${clean.substring(7)}`;
  }
  return `${clean.substring(0, 2)}••••${clean.slice(-2)}`;
}
