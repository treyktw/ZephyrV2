// lib/utils/crypto.ts
import { createHash } from 'crypto';

// Simple but effective email obfuscation
export function encryptEmail(email: string): string {
  // Create hash from email
  const hash = createHash('sha256')
    .update(email + (process.env.NEXTAUTH_SECRET || ''))
    .digest('hex')
    .slice(0, 10); // Take first 10 characters of hash

  // Base64 encode the email and hash
  const encoded = Buffer.from(email).toString('base64');

  // Combine them
  return `${encoded}.${hash}`;
}

export function decryptEmail(encrypted: string): string {
  try {
    // Split the encoded email and hash
    const [encoded, hash] = encrypted.split('.');

    // Decode the email
    const email = Buffer.from(encoded, 'base64').toString('utf-8');

    // Verify the hash
    const verifyHash = createHash('sha256')
      .update(email + (process.env.NEXTAUTH_SECRET || ''))
      .digest('hex')
      .slice(0, 10);

    // Check if hashes match
    if (hash !== verifyHash) {
      throw new Error('Invalid email hash');
    }

    return email;
  } catch (error) {
    console.error('Failed to decrypt email:', error);
    return '';
  }
}

// Utility function to mask email for display
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) return email;

  const maskedLocal = localPart.length > 3
    ? `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`
    : `${localPart[0]}${'*'.repeat(localPart.length - 1)}`;

  return `${maskedLocal}@${domain}`;
}
