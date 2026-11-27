import assert from 'node:assert/strict';
import test from 'node:test';
import { generateUsername, isValidUsername, normalizeUsername } from '../src/utils/username.js';

test('generated usernames are readable and use a compact suffix', () => {
  const first = generateUsername('Álice Smith');

  assert.match(first, /^alice-smith-[a-f0-9]{8}$/);
  assert.equal(isValidUsername(first), true);
});

test('username normalization and validation enforce a safe handle format', () => {
  assert.equal(normalizeUsername('  Study_User-1  '), 'study_user-1');
  assert.equal(isValidUsername('study_user-1'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('-invalid'), false);
  assert.equal(isValidUsername('invalid name'), false);
});
