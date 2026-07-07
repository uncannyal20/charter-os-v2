import { createHmac, timingSafeEqual } from 'crypto';
import { serialize } from 'cookie';

const COOKIE_NAME = 'charter_session';
const MAX_AGE_S   = 8 * 60 * 60; // 8 hours in seconds

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SESSION_PASSWORD = process.env.SESSION_PASSWORD;
  const SESSION_SECRET   = process.env.SESSION_SECRET;

  if (!SESSION_PASSWORD || !SESSION_SECRET) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password required' });

  // Timing-safe comparison
  let match = false;
  try {
    match = timingSafeEqual(
      Buffer.from(password),
      Buffer.from(SESSION_PASSWORD)
    );
  } catch {
    match = false;
  }

  if (!match) return res.status(401).json({ error: 'Invalid password' });

  // Build signed token: "{expiresAt}.{hmac}"
  const expiresAt = String(Date.now() + MAX_AGE_S * 1000);
  const token = `${expiresAt}.${sign(expiresAt, SESSION_SECRET)}`;

  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   MAX_AGE_S,
    path:     '/'
  }));

  return res.status(200).json({ success: true });
}
