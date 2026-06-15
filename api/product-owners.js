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

  // ── AUTH: verify PO login (used by /approval portal) ─────────────────────
  // POST /api/product-owners?action=auth  { email, password }
  if (action === 'auth') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/product_owners?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}&select=id,team_id,name,email`, {
      headers
    });
    const data = await r.json();
    if (!data || data.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    return res.status(200).json({ success: true, po: data[0] });
  }

  // ── GET ALL: list all POs (used by superadmin) ────────────────────────────
  // GET /api/product-owners?action=list
  if (action === 'list') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/product_owners?select=*&order=team_id.asc`, { headers });
    const data = await r.json();
    return res.status(200).json(data);
  }

  // ── CREATE: add new PO ────────────────────────────────────────────────────
  // POST /api/product-owners?action=create  { team_id, name, email, password }
  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id, name, email, password } = req.body;
    if (!team_id || !name || !email || !password)
      return res.status(400).json({ error: 'team_id, name, email, password required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/product_owners`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ team_id, name, email, password })
    });
    if (!r.ok) {
      const err = await r.json();
      return res.status(400).json({ error: err.message || 'Failed to create product owner' });
    }
    const data = await r.json();
    return res.status(201).json({ success: true, po: data[0] });
  }

  // ── UPDATE: edit PO (e.g. reset password) ────────────────────────────────
  // PUT /api/product-owners?action=update  { team_id, name?, email?, password? }
  if (action === 'update') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id, ...fields } = req.body;
    if (!team_id) return res.status(400).json({ error: 'team_id required' });

    const payload = { ...fields, updated_at: new Date().toISOString() };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/product_owners?team_id=eq.${team_id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return res.status(400).json({ error: 'Failed to update product owner' });
    return res.status(200).json({ success: true });
  }

  // ── DELETE: remove PO ─────────────────────────────────────────────────────
  // DELETE /api/product-owners?action=delete&team_id=team-a
  if (action === 'delete') {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id } = req.query;
    if (!team_id) return res.status(400).json({ error: 'team_id required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/product_owners?team_id=eq.${team_id}`, {
      method: 'DELETE',
      headers: { ...headers, 'Prefer': 'return=minimal' }
    });
    if (!r.ok) return res.status(400).json({ error: 'Failed to delete product owner' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
