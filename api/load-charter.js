export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set.' });

  const { team_id } = req.query;
  if (!team_id) return res.status(400).json({ error: 'team_id required' });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/charters?team_id=eq.${team_id}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await response.json();
    return res.status(200).json(data && data.length > 0 ? data[0] : null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
