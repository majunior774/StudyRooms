import { Router } from 'express';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import { generateUsername, isValidUsername, normalizeUsername } from '../utils/username.js';

const router = Router();
const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'sr_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_BYTES = 64;
const DUMMY_PASSWORD_HASH = 'e4df7d8a7bc5a7c9d9ab534ed476fa182a5d811e99761b20cfc57e63c08ed3e2906ef3ad7e993550668fa5ba39c5f28a4c17ea8f6c2c97fe1d21e32b82c9e4f0';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };
}

function readSessionToken(req) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : null;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    username: user.username,
  };
}

export async function ensureUsername(user) {
  if (user.username) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = generateUsername(user.displayName);
    try {
      const result = await User.updateOne(
        { _id: user._id, username: { $exists: false } },
        { $set: { username } }
      );
      if (result.matchedCount === 0) {
        const currentUser = await User.findById(user._id).select('username');
        if (!currentUser?.username) throw new Error('Account no longer exists.');
        user.username = currentUser.username;
        return;
      }
      user.username = username;
      return;
    } catch (error) {
      if (error?.code !== 11000 || !error.keyPattern?.username) throw error;
    }
  }
  throw new Error('Could not generate an available username.');
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, PASSWORD_BYTES);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, encodedHash) {
  const [salt, expectedHex] = (encodedHash || '').split(':');
  if (!salt || !expectedHex || !/^[\da-f]+$/i.test(salt) || !/^[\da-f]+$/i.test(expectedHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== PASSWORD_BYTES) return false;
  const actual = await scrypt(password, salt, PASSWORD_BYTES);
  return timingSafeEqual(expected, actual);
}

async function issueSession(user, res) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await UserSession.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt,
  });
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: SESSION_DURATION_MS,
  });
}

export async function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }

  const session = await UserSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).select('userId');

  if (!session) {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  req.userId = session.userId;
  next();
}

router.post('/register', async (req, res) => {
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!displayName || displayName.length > 80) {
    return res.status(400).json({ error: 'Enter a display name up to 80 characters.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Use a password between 8 and 128 characters.' });
  }

  try {
    const user = new User({
      displayName,
      email,
      passwordHash: await hashPassword(password),
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      user.username = generateUsername(displayName);
      try {
        await user.save();
        break;
      } catch (error) {
        if (
          error?.code !== 11000 ||
          !error.keyPattern?.username ||
          attempt === 4
        ) {
          throw error;
        }
      }
    }
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    if (error?.code === 11000 && error.keyPattern?.username) {
      return res.status(409).json({ error: 'Could not generate an available username. Please try again.' });
    }
    throw error;
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password || password.length > 128) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  const encodedHash = user?.passwordHash ?? `00000000000000000000000000000000:${DUMMY_PASSWORD_HASH}`;
  const passwordMatches = await verifyPassword(password, encodedHash);
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  await ensureUsername(user);
  await issueSession(user, res);
  return res.json({ user: publicUser(user) });
});

router.post('/logout', async (req, res) => {
  const token = readSessionToken(req);
  if (token) await UserSession.deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('email displayName username');
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  await ensureUsername(user);
  return res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const updates = {};
  if (Object.hasOwn(body, 'displayName')) {
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!displayName || displayName.length > 80) {
      return res.status(400).json({ error: 'Enter a display name up to 80 characters.' });
    }
    updates.displayName = displayName;
  }
  if (Object.hasOwn(body, 'username')) {
    const username = normalizeUsername(body.username);
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Use a username with 3–32 letters, numbers, underscores, or hyphens.' });
    }
    updates.username = username;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide a display name or username to update.' });
  }
  let user;
  try {
    user = await User.findByIdAndUpdate(
      req.userId,
      updates,
      { new: true, runValidators: true, select: 'email displayName username' }
    );
  } catch (error) {
    if (error?.code === 11000 && updates.username) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    throw error;
  }
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  return res.json({ user: publicUser(user) });
});

export default router;
