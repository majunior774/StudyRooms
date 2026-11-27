import { randomBytes } from 'node:crypto';

export function generateUsername(displayName) {
  const namePrefix = String(displayName ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16)
    .replace(/-+$/g, '');
  const prefix = namePrefix || 'user';
  const suffix = randomBytes(4).toString('hex');
  return `${prefix}-${suffix}`;
}

export function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidUsername(username) {
  return /^[a-z0-9][a-z0-9_-]{2,31}$/.test(username);
}
