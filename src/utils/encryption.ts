import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const getKey = (): Buffer => {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error('ENCRYPTION_KEY is not defined');
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
};

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export class SecretValue {
  private value: string | null;
  private revealed = false;

  constructor(value: string) {
    this.value = value;
  }

  reveal(): string {
    if (this.value === null) {
      throw new Error('SecretValue has already been consumed');
    }
    this.revealed = true;
    return this.value;
  }

  toString(): string {
    return this.revealed ? '[REDACTED - revealed once]' : '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }

  destroy(): void {
    this.value = null;
  }
}

export const encrypt = (plaintext: string): EncryptedPayload => {
  const key = getKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
};

export const decrypt = (payload: EncryptedPayload): SecretValue => {
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const plaintext = decrypted.toString('utf8');

  return new SecretValue(plaintext);
};