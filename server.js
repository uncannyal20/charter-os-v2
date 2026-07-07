import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import claudeHandler from './api/claude.js';
import saveCharterHandler from './api/save-charter.js';
import loadCharterHandler from './api/load-charter.js';
import getAllHandler from './api/get-all.js';
import adminsHandler from './api/admins.js';
import approvalsHandler from './api/approvals.js';
import productOwnersHandler from './api/product-owners.js';
import superadminAuthHandler from './api/superadmin-auth.js';
import teamsHandler from './api/teams.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ── API routes ────────────────────────────────────────────────
app.all('/api/claude',           (req, res) => claudeHandler(req, res));
app.all('/api/save-charter',     (req, res) => saveCharterHandler(req, res));
app.all('/api/load-charter',     (req, res) => loadCharterHandler(req, res));
app.all('/api/get-all',          (req, res) => getAllHandler(req, res));
app.all('/api/admins',           (req, res) => adminsHandler(req, res));
app.all('/api/approvals',        (req, res) => approvalsHandler(req, res));
app.all('/api/product-owners',   (req, res) => productOwnersHandler(req, res));
app.all('/api/superadmin-auth',  (req, res) => superadminAuthHandler(req, res));
app.all('/api/teams',            (req, res) => teamsHandler(req, res));

// ── Page routes ───────────────────────────────────────────────
const page = (file) => (req, res) => res.sendFile(join(__dirname, 'public', file));

app.get('/admin',        page('admin.html'));
app.get('/superadmin',   page('superadmin.html'));
app.get('/approval',     page('approval.html'));
app.get('/promo',        page('promo.html'));
app.get('/learning',     page('learning.html'));
app.get('/use-cases',    page('use-cases.html'));
app.get('/hub',          page('hub.html'));
app.get('/architecture', page('architecture.html'));

// ── Catch-all ─────────────────────────────────────────────────
app.get('*', page('index.html'));

app.listen(PORT, () => {
  console.log(`CharterOS running on http://localhost:${PORT}`);
});
