export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set.' });

  const { team_id, charter_name, state, progress_team, progress_problem, progress_vision, progress_kpis, progress_roadmap, progress_overall } = req.body;
  if (!team_id) return res.status(400).json({ error: 'team_id required' });

  try {
    // Upsert — one charter per team for prototyping
    const response = await fetch(`${SUPABASE_URL}/rest/v1/charters?team_id=eq.${team_id}`, {
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
    });
    const existing = await response.json();

    const payload = {
      team_id, charter_name, state,
      progress_team, progress_problem, progress_vision,
      progress_kpis, progress_roadmap, progress_overall,
      updated_at: new Date().toISOString()
    };

    let saveRes;
    if (existing && existing.length > 0) {
      saveRes = await fetch(`${SUPABASE_URL}/rest/v1/charters?team_id=eq.${team_id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload)
      });
    } else {
      saveRes = await fetch(`${SUPABASE_URL}/rest/v1/charters`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload)
      });
    }

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return res.status(saveRes.status).json({ error: err });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
