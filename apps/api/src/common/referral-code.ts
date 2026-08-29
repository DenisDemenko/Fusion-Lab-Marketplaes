import { randomInt } from 'node:crypto';

// Excludes visually ambiguous characters (0/O, 1/I/L) — this code gets
// read aloud, typed from a screenshot, and pasted into chat messages, so
// every character has to survive that without a support ticket.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 7;

// Callers handle the (astronomically unlikely, 32^7 code space) collision
// case themselves by retrying on the database's own unique-constraint
// error — see UsersService.syncFromFirebase — rather than this function
// pre-checking uniqueness on every call.
export function randomReferralCode(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
