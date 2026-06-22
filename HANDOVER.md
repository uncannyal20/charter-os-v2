# CharterOS — Session Handover Document

Generated: 22 June 2026
Last updated: 17:19 220626
Prepared for: Claude Code session continuity

---

## PROJECT OVERVIEW

**Product:** CharterOS v2 — AI-Powered Product Charter Platform
**GitHub Repo:** github.com/uncannyal20/charter-os-v2
**Deployment:** Vercel (auto-deploys on GitHub push)
**Stack:** HTML/CSS/JS (multi-portal) · Vercel Serverless API · Anthropic Claude API · Supabase PostgreSQL

---

## LIVE ROUTES

| Route            | File                     | Purpose                       |
|------------------|--------------------------|-------------------------------|
| /                | public/index.html        | Main charter app              |
| /admin           | public/admin.html        | TPO Admin Portal              |
| /approval        | public/approval.html     | PO Approval Portal            |
| /promo           | public/promo.html        | Marketing/promo page          |
| /learning        | public/learning.html     | Learning hub                  |
| /use-cases       | public/use-cases.html    | Use cases + sample downloads  |
| /hub             | public/hub.html          | Links hub to all pages        |
| /architecture    | public/architecture.html | System architecture reference |
| /api/claude      | api/claude.js            | Anthropic AI proxy            |
| /api/save-charter| api/save-charter.js      | Save to Supabase              |
| /api/load-charter| api/load-charter.js      | Load from Supabase            |
| /api/get-all     | api/get-all.js           | Admin: all charters           |
| /api/approvals   | api/approvals.js         | Approval workflow API         |
| /api/product-owners | api/product-owners.js | PO authentication             |

---

## TEAM PASSWORDS

| Password     | Team ID | Department                    | Charter                                                  |
|--------------|---------|-------------------------------|----------------------------------------------------------|
| teamA2026    | team-a  | Digital Services Office       | HDB Maintenance & Estate Services Digital Transformation |
| teamB2026    | team-b  | Estate Management Division    | Resident Feedback & Engagement Platform                  |
| teamC2026    | team-c  | Estate Management Division    | Municipal Smart Sensor & IoT Network Platform            |
| teamD2026    | team-d  | Citizen Experience Group      | Community Space Booking & Management System              |
| teamE2026    | team-e  | Building Infrastructure & Ops | Predictive Lift Maintenance Intelligence System          |
| tpoadmin2026 | admin   | TPO Admin                     | /admin portal                                            |

## PO PASSWORDS

| Email                   | Password | Team   |
|-------------------------|----------|--------|
| po.teama@charteros.app  | poA2026  | team-a |
| po.teamb@charteros.app  | poB2026  | team-b |
| po.teamc@charteros.app  | poC2026  | team-c |
| po.teamd@charteros.app  | poD2026  | team-d |
| po.teame@charteros.app  | poE2026  | team-e |

---

## VERCEL ENVIRONMENT VARIABLES

| Variable          | Service   | Purpose                |
|-------------------|-----------|------------------------|
| ANTHROPIC_API_KEY | Anthropic | Powers all 6 AI agents |
| SUPABASE_URL      | Supabase  | Database endpoint      |
| SUPABASE_KEY      | Supabase  | Database auth key      |

---

## SUPABASE SCHEMA

### Table: charters
- id (uuid, PK)
- team_id (text, UNIQUE)
- charter_name (text)
- state (jsonb) — full charter blob
- progress_team, progress_problem, progress_vision, progress_kpis, progress_roadmap, progress_overall (integer)
- updated_at (timestamptz)

### Table: approvals
- id (uuid, PK)
- team_id (text)
- section (text) — tor | problem | vision | kpis | roadmap | cba
- status (text) — draft | pending | approved | revision
- submitted_by (text)
- submitted_at (timestamptz)
- reviewed_at (timestamptz)
- comment (text)
- annotations (jsonb)
- revision_count (integer)
- team_replies (jsonb)

### Table: product_owners
- id (uuid, PK)
- team_id (text)
- name (text)
- email (text)
- password (text)
- created_at, updated_at (timestamptz)

---

## THE 6 AI AGENTS

| # | Agent             | Type          | Input                        | Output                      |
|---|-------------------|---------------|------------------------------|-----------------------------|
| 1 | TOR Drafter       | Autonomous    | Team members + meetings      | 5-section TOR HTML          |
| 2 | Problem Analyst   | Multi-Source  | Raw notes + uploaded files   | 5-section problem HTML      |
| 3 | Vision Strategist | Context-Aware | Problem ✓ + notes + files    | Vision HTML with pillars    |
| 4 | KPI Recommender   | Context-Aware | Problem ✓ + Vision ✓ + files | JSON array 6-8 KPIs         |
| 5 | CBA Analyst       | Tool-Using    | KPIs + benefit values + costs| HTML narrative + SGD figures|
| 6 | Roadmap Architect | Autonomous    | Epics + duration + team size | JSON phases + Gantt data    |

---

## APPROVAL WORKFLOW

Full PM → PO approval flow now implemented:

1. Team generates each section in main app
2. Team clicks **📤 Submit for PO Review** — sets status to `pending` in approvals table
3. PO logs into `/approval` portal with PO credentials
4. PO sees pending sections, can Approve or Send Back with comments
5. On next team login, `syncApprovalsIntoState()` runs after `loadFromCloud()` and stamps approved flags into S
6. Progress % updates to 100% for approved sections

### Section order in approval portal:
01 TOR → 02 Problem → 03 Vision → 04 KPIs → 05 CBA → 06 Roadmap

### Key approval functions in index.html:
- `submitForPOReview(section, label)` — submits a section
- `approveTOR()`, `approveCBA()` — section-specific submit wrappers
- `syncApprovalsIntoState()` — called inside `loadFromCloud()` after `Object.assign(S, data.state)`
- `loadApprovals()` — fetches window.APPROVALS from Supabase
- `clearCharter()` — resets charter + calls `/api/approvals?action=reset` to wipe all approvals

### Key approval functions in approval.html:
- `approveSection(key)` — PO approves a section
- `sendBackSection(key)` — PO sends back with comments
- `renderRoadmap()` — tabbed: Phases & Tasks + Gantt Chart with month headers
- `renderCBA()` — renders prose + CBA charts (Chart.js)
- `renderCBACharts()` — called after renderSection for CBA key

### Critical session restore fix:
Both login paths must await loadApprovals before onTeamLoggedIn:
```javascript
// Fresh login (line ~633):
await loadApprovals();
onTeamLoggedIn();

// Session restore (line ~1043):
window.addEventListener('DOMContentLoaded', async () => {
  await loadApprovals();
  onTeamLoggedIn();
});
```

---

## PROGRESS SCORING

| Section  | Scoring breakdown                                              | Max |
|----------|----------------------------------------------------------------|-----|
| Team     | members ≥3 (50) + meetings ≥3 (30) + tor_approved (20)        | 100 |
| Problem  | notes/files (30) + draft (50) + approved (20)                  | 100 |
| Vision   | notes/files (30) + draft (50) + approved (20)                  | 100 |
| KPIs     | items (40) + approved (30) + cba.approved (10) + notes (20)    | 100 |
| Roadmap  | epics/files/phases_data (20) + draft (40) + tasks_approved (20) + timeline_approved (20) | 100 |

---

## KEY FEATURES IN index.html

- Team-specific localStorage keys (charter_os_data_team-a etc.)
- Sample data for all 5 teams (SAMPLE_DATA object)
- **Load from ZIP** button on Problem, Vision, KPIs, Roadmap sections — auto-extracts correct folder
- ZIP_FOLDER_MAP: problem→02_Problem/, vision→03_Vision/, kpis→04_KPIs/, roadmap→05_Roadmap/
- Two-stage roadmap approval (tasks → timeline)
- Custom HTML/CSS Gantt chart renderer with month/year headers
- KPI flow banner (5-step) showing Generate KPIs → Submit → Upload CBA → Generate CBA → Submit CBA
- Client-side PDF export (html2canvas + jsPDF) — opens print dialogue in new tab
- Client-side PPTX generation (PptxGenJS from unpkg CDN) — **Generate Summary Slides** (12 slides)
- CBA Excel download (SheetJS)
- Collapsible sidebar, dark/light mode toggle
- Auto-save to Supabase every 3 seconds (scheduleSave)
- Read-only mode: /?team=team-a&readonly=true
- Admin portal link on login screen
- Sign Out button in sidebar
- Activity log collapsible (click header to toggle, persists via localStorage)
- PO approval notification banner (green, dismissable with ✕, resets on logout)
- Sidebar + main content hidden on page load until login (prevents flash)

---

## SUMMARY SLIDES (12 slides)

Generated via `generateSummarySlides()`:
1. Cover
2. Agenda
3. Problem Statement
4. Vision & Strategy
5. Team Structure & TOR
6. KPIs & Success Metrics
7. Cost Benefit Analysis (text + metric boxes)
8. Product Roadmap (phases)
9. **CBA Charts** (bar + donut — captures canvas from CBA tab)
10. **Delivery Timeline / Gantt** (custom Gantt with month headers from phases_data)
11. Next Steps
12. Closing

> **Note (220626):** The slide list above is the original design intent. In the current code the deck builds slides s1–s10 (Cover … Closing) and the **CBA Charts** slide is inserted after the CBA-text slide *only when* charts were captured. The standalone Gantt-image slide is **not** currently in the deck. Chart capture no longer relies on a fixed `setTimeout`: charts are re-rendered synchronously, then captured from the Chart.js instance via `chart.toBase64Image()` after `chart.update('none')`.

---

## SAMPLE INPUT FILES (public/sample-inputs/)

Each team ZIP has 6 folders, 10 files total:
```
01_TOR/Team_Roster_and_Meeting_Cadence.txt
02_Problem/Problem_Notes.txt
02_Problem/Stakeholder_Input_Notes.txt
03_Vision/Vision_Workshop_Notes.txt
03_Vision/Vision_Strategy_Input.pptx
04_KPIs/KPI_Brainstorm_Notes.txt
04_KPIs/KPI_Register.xlsx
05_Roadmap/Epic_Breakdown_Notes.txt
05_Roadmap/Roadmap_Input.pptx
06_CBA/CBA_Benefit_Estimates.xlsx
```

Team C also has a separate `Team_C_Cost_Estimates.xlsx` (one-off + recurring costs, 3-tab Excel).

---

## PENDING / NEXT TO BUILD

### High Priority
1. **Cost estimates Excel for Teams A, B, D, E** — Team C has one, others need to be built

### Medium Priority
5. **Promo page video** — placeholder exists in promo.html, needs `playVideo()` wired up once recorded
6. **Admin portal** — review current state, ensure super admin can see all team progress
7. **Un-approve button in approval portal** — PO can currently only approve or send back; un-approve (→ pending) not yet in UI (workaround: direct SQL)

### Low Priority
8. **Email notifications via Resend** — `po_email` column needed in product_owners, RESEND_API_KEY env var needed
9. **CBA sample files for Teams A, B, D, E** — only Team C has cost estimates Excel

---

## RECENTLY COMPLETED (session — 17:19 220626)

- ✅ **Team structure org chart in TOR** — tiered org chart (Leadership → Management/Tech Lead → Delivery) in the TOR tab of index.html (`buildOrgChart()` / `renderTeamChart()`), and shown above the TOR document in the approval portal (`renderTOR()` reads `charterState.members`). Updates live as members change.
- ✅ **Direct PDF download** — jsPDF now loaded; `exportAsPDF()` renders the charter print-HTML into an offscreen iframe and downloads a real .pdf page-by-page via new `htmlToPdfDownload()` (no new tab / print dialogue). Falls back to print-tab if libs unavailable.
- ✅ **CBA chart capture fix** — charts re-rendered synchronously and captured from the Chart.js instance via `toBase64Image()` after `update('none')` (removes the animation-timing race that produced blank images). The captured bar/donut/waterfall images were previously dead code — now embedded in a dedicated "Cost Benefit Analysis — Charts" slide in `generateSummarySlides()`.
- ✅ **Dark/light theme toggle in approval portal** — topbar toggle, `body.light-mode` palette override, low-contrast colours converted to theme-aware vars; preference persists via `charter_os_theme` localStorage key (shared with main app).
- ✅ **Approval portal — Send back / Approve toolbar mirrored below content** — `renderActionBar()` split into `renderActionToolbar(key,status,ap,pos)` (rendered top + bottom) and `renderSendBackArea()` (rendered once, below content). `toggleSendBack()` now scrolls the note box into view + focuses it. Bottom bar/note only show while still actionable (hidden once approved).
- ✅ **Approval portal — light-mode button legibility** — Send back / Approve / Confirm buttons use a new `.btn-action` class; `body.light-mode .btn-action { color:#fff }` makes their text white in light mode (dark text retained in dark mode).
- ✅ **Hub page trimmed** — removed the Quick Links section (download links + read-only team views) and the platform/portals/teams/AI-agents/database status row from hub.html, plus their now-unused CSS.

Commits: `cd5f786` (org chart) · `83c909c` (PDF + CBA capture) · `4d9272e` (theme toggle) · `339888d` (approval bottom bar + light-mode buttons) · `0d688be` (hub trim) — all pushed to origin/main.

---

## RECENTLY COMPLETED (this session — 17–22 June 2026)

- ✅ Full approval workflow (submit → PO review → approve/send back)
- ✅ syncApprovalsIntoState() — approval flags synced after loadFromCloud
- ✅ Session restore fix — await loadApprovals before onTeamLoggedIn
- ✅ TOR scheduleSave() fix — TOR now saves to Supabase on generation
- ✅ Progress % hits 100% for all sections after PO approval
- ✅ Roadmap progress counts phases_data as input (no epics needed)
- ✅ CBA submit flow — replaced Approve CBA with Submit for PO Review
- ✅ CBA status-aware button (draft/pending/approved states)
- ✅ Approval portal — CBA above Roadmap in sidebar (section 05/06)
- ✅ Roadmap Gantt with month/year headers in approval portal (tabbed)
- ✅ CBA charts in approval portal (Chart.js)
- ✅ PO approval notification banner (dismissable, resets on logout)
- ✅ Activity log collapsible
- ✅ KPI flow banner (5-step)
- ✅ Load from ZIP on Problem, Vision, KPIs, Roadmap sections
- ✅ Sample input ZIPs rebuilt with 6 folders (added 06_CBA)
- ✅ use-cases.html updated with correct file counts
- ✅ Generate Summary Slides (renamed from Generate Slides)
- ✅ Slide 9: CBA Charts + Slide 10: Gantt added to deck
- ✅ clearCharter() resets approvals via /api/approvals?action=reset
- ✅ approvals.js: new reset action added
- ✅ Approval portal: draft sections show "Not yet submitted" (removed hasContent bypass)
- ✅ Sidebar + main hidden until login (no flash on page load)
- ✅ Team C CBA benefit estimates + cost estimates Excel files

---

## ARCHITECTURAL NOTES

### State management
- `S` = in-memory charter state object
- `saveState()` = writes S to localStorage only
- `scheduleSave()` = debounced write to Supabase (3s delay)
- `loadFromCloud()` = reads from Supabase, overwrites S, then calls syncApprovalsIntoState()
- `window.APPROVALS` = approval statuses fetched from approvals table

### Key patterns
- Raw fetch calls to Supabase REST API (no SDK)
- CSS class-based event delegation for interactive elements
- All 6 API routes explicitly declared in vercel.json
- PptxGenJS loaded from unpkg CDN
- JSZip already loaded (used for Load from ZIP feature)
- Chart.js loaded in approval.html for CBA charts

### File structure
```
public/
  index.html          ← main app (5,300+ lines)
  approval.html       ← PO approval portal
  admin.html          ← super admin
  hub.html, promo.html, learning.html, use-cases.html, architecture.html
  sample-inputs/      ← 5 team ZIP files
api/
  claude.js, save-charter.js, load-charter.js, get-all.js
  approvals.js, product-owners.js
vercel.json           ← explicit routes for all pages and API endpoints
```

---

*End of handover document — generated 22 June 2026*
