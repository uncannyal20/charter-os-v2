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

  // ── AUTH: verify team login (used by index.html) ──────────────────────────
  // POST /api/teams?action=auth  { password }
  // Login screen is password-only — look up team by password
  if (action === 'auth') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/teams?password=eq.${encodeURIComponent(password)}&select=team_id,team_name,department`, {
      headers
    });
    const data = await r.json();
    if (!data || data.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    return res.status(200).json({ success: true, team: data[0] });
  }

  // ── GET ALL: list all teams (used by superadmin) ──────────────────────────
  // GET /api/teams?action=list
  if (action === 'list') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=*&order=team_id.asc`, { headers });
    const data = await r.json();
    return res.status(200).json(data);
  }

  // ── CREATE: add new team ──────────────────────────────────────────────────
  // POST /api/teams?action=create  { team_id, team_name, department, password }
  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id, team_name, department, password } = req.body;
    if (!team_id || !team_name || !department || !password)
      return res.status(400).json({ error: 'team_id, team_name, department, password required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ team_id, team_name, department, password })
    });
    if (!r.ok) {
      const err = await r.json();
      return res.status(400).json({ error: err.message || 'Failed to create team' });
    }
    const data = await r.json();
    return res.status(201).json({ success: true, team: data[0] });
  }

  // ── UPDATE: edit team ─────────────────────────────────────────────────────
  // PUT /api/teams?action=update  { team_id, team_name?, department?, password? }
  if (action === 'update') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id, ...fields } = req.body;
    if (!team_id) return res.status(400).json({ error: 'team_id required' });

    const payload = { ...fields, updated_at: new Date().toISOString() };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/teams?team_id=eq.${team_id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return res.status(400).json({ error: 'Failed to update team' });
    return res.status(200).json({ success: true });
  }

  // ── DELETE: remove team ───────────────────────────────────────────────────
  // DELETE /api/teams?action=delete&team_id=team-a
  if (action === 'delete') {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id } = req.query;
    if (!team_id) return res.status(400).json({ error: 'team_id required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/teams?team_id=eq.${team_id}`, {
      method: 'DELETE',
      headers: { ...headers, 'Prefer': 'return=minimal' }
    });
    if (!r.ok) return res.status(400).json({ error: 'Failed to delete team' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
