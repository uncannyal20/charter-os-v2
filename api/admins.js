export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set.' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const action = req.query.action;

  // ── AUTH: verify admin login (used by /admin portal) ─────────────────────
  // POST /api/admins?action=auth  { email, password }
  if (action === 'auth') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}&select=id,name,email`, {
      headers
    });
    const data = await r.json();
    if (!data || data.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    return res.status(200).json({ success: true, admin: data[0] });
  }

  // ── GET ALL: list all admins (used by superadmin) ─────────────────────────
  // GET /api/admins?action=list
  if (action === 'list') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=id,name,email,created_at&order=created_at.asc`, { headers });
    const data = await r.json();
    return res.status(200).json(data);
  }

  // ── CREATE: add new admin ─────────────────────────────────────────────────
  // POST /api/admins?action=create  { name, email, password }
  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email, password required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ name, email, password })
    });
    if (!r.ok) {
      const err = await r.json();
      return res.status(400).json({ error: err.message || 'Failed to create admin' });
    }
    const data = await r.json();
    return res.status(201).json({ success: true, admin: data[0] });
  }

  // ── UPDATE: edit admin (e.g. reset password) ──────────────────────────────
  // PUT /api/admins?action=update  { id, name?, email?, password? }
  if (action === 'update') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const { id, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const payload = { ...fields, updated_at: new Date().toISOString() };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return res.status(400).json({ error: 'Failed to update admin' });
    return res.status(200).json({ success: true });
  }

  // ── DELETE: remove admin ──────────────────────────────────────────────────
  // DELETE /api/admins?action=delete&id=<uuid>
  if (action === 'delete') {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins?id=eq.${id}`, {
      method: 'DELETE',
      headers: { ...headers, 'Prefer': 'return=minimal' }
    });
    if (!r.ok) return res.status(400).json({ error: 'Failed to delete admin' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
