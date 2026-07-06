import { createHmac, randomBytes } from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32Decode(str) {
  str = str.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function b32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}

function totpCode(secret, counter) {
  const key = b32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

function totpVerify(token, secret, window = 1) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (totpCode(secret, counter + i) === token) return true;
  }
  return false;
}

function generateSecret() { return b32Encode(randomBytes(20)); }

function keyuri(account, issuer, secret) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set.' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const { action } = req.body;

  // ── SETUP: generate secret + return QR code URI ───────────────
  // POST { action: 'setup' }
  // Only works if no secret exists yet — or if force=true
  if (action === 'setup') {
    const { force } = req.body;

    // Check if secret already exists
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/superadmin_config?select=id&limit=1`, { headers });
    const existingData = await existing.json();

    if (existingData.length > 0 && !force) {
      return res.status(400).json({ error: 'TOTP already configured. Pass force=true to regenerate.' });
    }

    // Generate new secret
    const secret = generateSecret();

    // Delete existing if regenerating
    if (existingData.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/superadmin_config?id=eq.${existingData[0].id}`, {
        method: 'DELETE',
        headers: { ...headers, 'Prefer': 'return=minimal' }
      });
    }

    // Store new secret
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/superadmin_config`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ totp_secret: secret })
    });

    if (!saveRes.ok) return res.status(500).json({ error: 'Failed to save secret' });

    // Return the otpauth URI for QR code generation (client generates QR from this)
    const otpauthUri = keyuri('superadmin', 'CharterOS', secret);
    return res.status(200).json({ success: true, otpauthUri });
  }

  // ── VERIFY: validate a 6-digit TOTP code ─────────────────────
  // POST { action: 'verify', code: '123456' }
  if (action === 'verify') {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });

    // Fetch secret from Supabase
    const r = await fetch(`${SUPABASE_URL}/rest/v1/superadmin_config?select=totp_secret&limit=1`, { headers });
    const data = await r.json();

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'TOTP not configured. Visit /superadmin?setup=true first.' });
    }

    const secret = data[0].totp_secret;

    // Validate with a 1-step window (accepts current + prev/next 30s window)
    const isValid = totpVerify(code, secret);

    if (!isValid) return res.status(401).json({ error: 'Invalid or expired code' });

    // Return a simple session token (timestamp-based, validated client-side)
    const sessionToken = Buffer.from(`charteros-sa-${Date.now()}`).toString('base64');
    return res.status(200).json({ success: true, sessionToken });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
