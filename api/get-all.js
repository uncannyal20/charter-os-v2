export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set.' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  try {
    // Get all teams — updated column names (team_id, team_name, department)
    const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=team_id,team_name,department&order=team_id.asc`, { headers });
    const teams = await teamsRes.json();

    // Get all charters
    const chartersRes = await fetch(`${SUPABASE_URL}/rest/v1/charters?select=team_id,charter_name,progress_team,progress_problem,progress_vision,progress_kpis,progress_roadmap,progress_overall,updated_at`, { headers });
    const charters = await chartersRes.json();

    // Get all approvals
    const approvalsRes = await fetch(`${SUPABASE_URL}/rest/v1/approvals?select=team_id,section,status&order=team_id.asc`, { headers });
    const approvals = await approvalsRes.json();

    // Merge teams with charter progress and approval statuses
    const result = teams.map(team => {
      const charter = charters.find(c => c.team_id === team.team_id) || null;
      const teamApprovals = Array.isArray(approvals)
        ? approvals.filter(a => a.team_id === team.team_id)
        : [];

      const approvalSummary = {};
      teamApprovals.forEach(a => { approvalSummary[a.section] = a.status; });

      return {
        team_id: team.team_id,
        team_name: team.team_name,
        department: team.department,
        charter_name: charter ? charter.charter_name : 'Not started',
        progress_overall: charter ? charter.progress_overall : 0,
        progress_team: charter ? charter.progress_team : 0,
        progress_problem: charter ? charter.progress_problem : 0,
        progress_vision: charter ? charter.progress_vision : 0,
        progress_kpis: charter ? charter.progress_kpis : 0,
        progress_roadmap: charter ? charter.progress_roadmap : 0,
        updated_at: charter ? charter.updated_at : null,
        approvals: approvalSummary
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
