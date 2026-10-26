# ShipLens Platform — Handover Documentation & Operational Runbook

> **Target Audience:** Incoming Engineering Leads, DevOps Engineers, and System Administrators  
> **Repository:** `ShipLens`  
> **Production URL:** [https://shiplens-platform.onrender.com](https://shiplens-platform.onrender.com)  

---

## 1. System Overview & Core Architecture

ShipLens is a centralized financial auditing, member intake, and branch governance system built to replace manual spreadsheet ledgers across distributed organizational chapters.

### Component Topology
- **Application Layer:** Node.js 20, Express, TypeScript (compiled to `dist/`)
- **Database Engine:** PostgreSQL 16 (Hosted on Render Managed DB)
- **Authentication & Session:** JWT-based stateless authentication backed by secure HTTP headers (`Authorization: Bearer <token>`) and role guards
- **Frontend Delivery:** Lightweight vanilla TypeScript/HTML5 SPA delivered via Express static serving with clean hash routing (`#home`, `#branches`, etc.)

---

## 2. Environment Variables & Secret Configuration

Production secrets are injected via the hosting environment (Render Dashboard → Environment). The application expects the following configuration keys:

| Variable | Type | Production Behavior | Local Default / Fallback |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | Must be set to `production` | `development` |
| `PORT` | Number | Managed dynamically by Render | `3000` |
| `DATABASE_URL` | URI | SSL-required PostgreSQL connection string | `postgresql://shiplens_user:shiplens_secret@localhost:5432/shiplens_db` |
| `JWT_SECRET` | String | Minimum 32-character high-entropy secret | Minimum 32-character dev string |

> **Security Note:** Never commit plain `.env` files into source control. Always refer to `.env.example` when provisioning new staging or local replicas.

---

## 3. Database Schema Migrations & Maintenance

Database changes are structured sequentially under `src/db/migrations/`:

1. `001_initial_schema.sql`: Extensions (`uuid-ossp`), tables (`users`, `branches`, `members`, `collections`, `weekly_reports`, `audit_logs`), and append-only database triggers.
2. `002_content_schema.sql`: Table `content_items` for public announcements and communications with `DRAFT` / `PUBLISHED` states.

### Applying Migrations Manually
To execute schema migrations against a live database instance:
```bash
PGPASSWORD="<DB_PASSWORD>" psql -h "<DB_HOST>" -U "<DB_USER>" -d "<DB_NAME>" -f src/db/migrations/001_initial_schema.sql
PGPASSWORD="<DB_PASSWORD>" psql -h "<DB_HOST>" -U "<DB_USER>" -d "<DB_NAME>" -f src/db/migrations/002_content_schema.sqls