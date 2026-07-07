import express from 'express';
import { createHmac } from 'crypto';
import { parse as parseCookies } from 'cookie';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authHandler          from './api/auth.js';
import claudeHandler        from './api/claude.js';
import saveCharterHandler   from './api/save-charter.js';
import loadCharterHandler   from './api/load-charter.js';
import getAllHandler         from './api/get-all.js';
import adminsHandler        from './api/admins.js';
import approvalsHandler     from './api/approvals.js';
import productOwnersHandler from './api/product-owners.js';
import superadminAuthHandler from './api/superadmin-auth.js';
import teamsHandler         from './api/teams.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Session helpers ───────────────────────────────────────────
const COOKIE_NAME  = 'charter_session';
const STATIC_EXT   = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp)$/i;
const AUTH_EXEMPT  = new Set(['/lock', '/api/auth']);

function verifySession(cookieHeader) {
  if (!cookieHeader) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  const token = parseCookies(cookieHeader)[COOKIE_NAME];
  if (!token) return false;

  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;

  const payload   = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected  = createHmac('sha256', secret).update(payload).digest('hex');
  if (expected !== signature) return false;

  const expiresAt = parseInt(payload, 10);
  return !isNaN(expiresAt) && Date.now() < expiresAt;
}

// ── Auth middleware ───────────────────────────────────────────
function requireAuth(req, res, next) {
  if (STATIC_EXT.test(req.path))    return next(); // static assets
  if (AUTH_EXEMPT.has(req.path))    return next(); // lock page + auth endpoint
  if (!process.env.SESSION_PASSWORD) return next(); // no password set — open

  if (verifySession(req.headers.cookie)) return next();

  // Redirect pages; reject API calls with 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  res.redirect(`/lock?from=${encodeURIComponent(req.originalUrl)}`);
}

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(requireAuth);
app.use(express.static(join(__dirname, 'public')));

// ── Auth + API routes ─────────────────────────────────────────
app.post('/api/auth',            (req, res) => authHandler(req, res));
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

app.get('/lock',         page('lock.html'));
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
