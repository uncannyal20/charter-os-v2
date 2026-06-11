export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set.' });

  try {
    // Get all teams
    const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id,name`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const teams = await teamsRes.json();

    // Get all charters
    const chartersRes = await fetch(`${SUPABASE_URL}/rest/v1/charters?select=team_id,charter_name,progress_team,progress_problem,progress_vision,progress_kpis,progress_roadmap,progress_overall,updated_at`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const charters = await chartersRes.json();

    // Merge teams with their charter progress
    const result = teams.map(team => {
      const charter = charters.find(c => c.team_id === team.id) || null;
      return {
        team_id: team.id,
        team_name: team.name,
        charter_name: charter ? charter.charter_name : 'Not started',
        progress_overall: charter ? charter.progress_overall : 0,
        progress_team: charter ? charter.progress_team : 0,
        progress_problem: charter ? charter.progress_problem : 0,
        progress_vision: charter ? charter.progress_vision : 0,
        progress_kpis: charter ? charter.progress_kpis : 0,
        progress_roadmap: charter ? charter.progress_roadmap : 0,
        updated_at: charter ? charter.updated_at : null
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
