import { randomBytes, randomUUID, } from 'node:crypto';


const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

export function generateId(): string {
  return randomUUID();
}

export function generateSessionCode(): string {
  const bytes = randomBytes(SESSION_CODE_LENGTH);
  let code = '';

  for (const value of bytes) {
    code += SESSION_CODE_ALPHABET[value % SESSION_CODE_ALPHABET.length];
  }

  return code;

}