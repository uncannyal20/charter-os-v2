import { authenticator } from 'otplib';

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
    const secret = authenticator.generateSecret();

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
    const otpauthUri = authenticator.keyuri('superadmin', 'CharterOS', secret);
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
    authenticator.options = { window: 1 };
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) return res.status(401).json({ error: 'Invalid or expired code' });

    // Return a simple session token (timestamp-based, validated client-side)
    const sessionToken = Buffer.from(`charteros-sa-${Date.now()}`).toString('base64');
    return res.status(200).json({ success: true, sessionToken });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
