const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Excludes: I, O, 0, 1 — easy to confuse when reading/typing

export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  let random = '';

  for (let i = 0; i < 6; i++) {
    random += CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  return `ORD-${year}-${random}`;
};