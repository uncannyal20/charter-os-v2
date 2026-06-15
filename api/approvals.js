export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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

  // ── LIST: get all approval records for a team ─────────────────
  // GET /api/approvals?action=list&team_id=team-a
  if (action === 'list') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id } = req.query;
    if (!team_id) return res.status(400).json({ error: 'team_id required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/approvals?team_id=eq.${team_id}&select=*`, { headers });
    const data = await r.json();
    return res.status(200).json(data);
  }

  // ── SUBMIT: team submits a section for PO review ──────────────
  // POST /api/approvals?action=submit  { team_id, section, submitted_by }
  if (action === 'submit') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id, section, submitted_by } = req.body;
    if (!team_id || !section) return res.status(400).json({ error: 'team_id and section required' });

    // Check if record exists
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/approvals?team_id=eq.${team_id}&section=eq.${section}&select=id`, { headers });
    const existingData = await existing.json();

    const { team_replies } = req.body;
    const payload = {
      status: 'pending',
      submitted_by: submitted_by || 'Team',
      submitted_at: new Date().toISOString(),
      team_replies: team_replies || {},
      reviewed_at: null
      // Note: annotations and comment are NOT reset here — PO's original comments are preserved
    };

    let r;
    if (existingData && existingData.length > 0) {
      r = await fetch(`${SUPABASE_URL}/rest/v1/approvals?team_id=eq.${team_id}&section=eq.${section}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload)
      });
    } else {
      r = await fetch(`${SUPABASE_URL}/rest/v1/approvals`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ team_id, section, ...payload })
      });
    }

    if (!r.ok) return res.status(400).json({ error: 'Failed to submit section' });
    return res.status(200).json({ success: true });
  }

  // ── UPDATE: PO approves or sends back a section ───────────────
  // PUT /api/approvals?action=update  { team_id, section, status, comment, annotations, reviewed_at }
  if (action === 'update') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const { team_id, section, status, comment, annotations, reviewed_at } = req.body;
    if (!team_id || !section || !status) return res.status(400).json({ error: 'team_id, section, status required' });

    const payload = {
      status,
      comment: comment || null,
      annotations: annotations || [],
      reviewed_at: reviewed_at || new Date().toISOString()
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/approvals?team_id=eq.${team_id}&section=eq.${section}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) return res.status(400).json({ error: 'Failed to update approval' });
    return res.status(200).json({ success: true });
  }

  // ── GET ALL: admin view — all approvals across all teams ──────
  // GET /api/approvals?action=all
  if (action === 'all') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/approvals?select=*&order=team_id.asc,section.asc`, { headers });
    const data = await r.json();
    return res.status(200).json(data);
  }

  return res.status(400).json({ error: 'Invalid action' });
}
