export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;

  if (username === 'superadmin' && password === '123456') {
    const sessionToken = Buffer.from(`charteros-sa-${Date.now()}`).toString('base64');
    return res.status(200).json({ success: true, sessionToken });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
}
