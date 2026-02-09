/**
 * Arcium Crypto Module
 * 
 * Uses Arcium SDK's x25519 key exchange and RescueCipher for
 * real cryptographic encryption of LP position data.
 * 
 * RescueCipher operates on field elements (BigInt). We encode
 * arbitrary string data as sequences of field elements, encrypt
 * them, and serialize the ciphertext for storage.
 */

import { x25519, RescueCipher, CURVE25519_SCALAR_FIELD_MODULUS } from '@arcium-hq/client';
import { randomBytes } from 'crypto';

// Maximum value per field element (must be < field modulus)
const FIELD_MODULUS = CURVE25519_SCALAR_FIELD_MODULUS;

// We encode strings as chunks of 30 bytes (fits safely in a 32-byte field element)
const CHUNK_SIZE = 30;

export interface EncryptionKeyPair {
  secretKey: Uint8Array;  // x25519 secret key (32 bytes)
  publicKey: Uint8Array;  // x25519 public key (32 bytes)
}

export interface EncryptedData {
  ciphertext: string;    // hex-encoded encrypted field elements
  nonce: string;         // hex-encoded nonce (16 bytes)
  publicKey: string;     // hex-encoded ephemeral public key
  elementCount: number;  // number of field elements
}

/**
 * Generate a new x25519 keypair for encryption
 */
export function generateKeyPair(): EncryptionKeyPair {
  const secretKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(secretKey);
  return { secretKey, publicKey };
}

/**
 * Derive a shared secret from our secret key and their public key
 */
export function deriveSharedSecret(
  ourSecretKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(ourSecretKey, theirPublicKey);
}

/**
 * Encode a string as an array of field elements (BigInt[])
 * Each chunk of 30 bytes becomes one field element
 */
export function stringToFieldElements(data: string): bigint[] {
  const buf = Buffer.from(data, 'utf-8');
  const elements: bigint[] = [];
  
  for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
    const chunk = buf.subarray(i, Math.min(i + CHUNK_SIZE, buf.length));
    // Prefix with length byte so we can strip padding on decode
    const padded = Buffer.alloc(CHUNK_SIZE + 1);
    padded[0] = chunk.length;
    chunk.copy(padded, 1);
    
    // Convert to BigInt (little-endian)
    let val = BigInt(0);
    for (let j = padded.length - 1; j >= 0; j--) {
      val = (val << BigInt(8)) | BigInt(padded[j]);
    }
    
    // Ensure it's within the field
    if (val >= FIELD_MODULUS) {
      val = val % FIELD_MODULUS;
    }
    
    elements.push(val);
  }
  
  return elements;
}

/**
 * Decode field elements back to a string
 */
export function fieldElementsToString(elements: bigint[]): string {
  const chunks: Buffer[] = [];
  
  for (const elem of elements) {
    // Convert BigInt to bytes (little-endian)
    const padded = Buffer.alloc(CHUNK_SIZE + 1);
    let val = elem;
    for (let j = 0; j < padded.length; j++) {
      padded[j] = Number(val & BigInt(0xFF));
      val = val >> BigInt(8);
    }
    
    const len = padded[0];
    chunks.push(padded.subarray(1, 1 + len));
  }
  
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Encrypt a string using RescueCipher with a shared secret
 */
export function encryptString(
  data: string,
  sharedSecret: Uint8Array
): EncryptedData {
  const ephemeral = generateKeyPair();
  const cipher = new RescueCipher(sharedSecret);
  const nonce = randomBytes(16);
  
  const elements = stringToFieldElements(data);
  const ciphertextArrays = cipher.encrypt(elements, nonce);
  
  // Serialize: each ciphertext element is a Uint8Array(32)
  const allCiphertext = Buffer.concat(
    ciphertextArrays.map(ct => Buffer.from(ct))
  );
  
  return {
    ciphertext: allCiphertext.toString('hex'),
    nonce: Buffer.from(nonce).toString('hex'),
    publicKey: Buffer.from(ephemeral.publicKey).toString('hex'),
    elementCount: elements.length,
  };
}

/**
 * Decrypt an encrypted string using RescueCipher with a shared secret
 */
export function decryptString(
  encrypted: EncryptedData,
  sharedSecret: Uint8Array
): string {
  const cipher = new RescueCipher(sharedSecret);
  const nonce = Buffer.from(encrypted.nonce, 'hex');
  const allCiphertext = Buffer.from(encrypted.ciphertext, 'hex');
  
  // Split back into 32-byte chunks
  const ciphertextArrays: Uint8Array[] = [];
  for (let i = 0; i < encrypted.elementCount; i++) {
    ciphertextArrays.push(new Uint8Array(allCiphertext.subarray(i * 32, (i + 1) * 32)));
  }
  
  const elements = cipher.decrypt(ciphertextArrays, nonce);
  return fieldElementsToString(elements);
}

/**
 * Encrypt arbitrary JSON-serializable data
 */
export function encryptJSON(
  data: unknown,
  sharedSecret: Uint8Array
): EncryptedData {
  return encryptString(JSON.stringify(data), sharedSecret);
}

/**
 * Decrypt to JSON
 */
export function decryptJSON<T = unknown>(
  encrypted: EncryptedData,
  sharedSecret: Uint8Array
): T {
  return JSON.parse(decryptString(encrypted, sharedSecret));
}
