# ShipLens Management Platform

ShipLens is a centralized operational and financial governance platform that connects regional branches with national headquarters. It provides strict role-based access control, integer-based currency accounting, structured report approval lifecycles, and tamper-resistant audit logs. It also serves the organisation's public website.

**Live demo:** <https://shiplens-platform.onrender.com>


---

## Architectural Principles

### 1. Integer-Based Paisa Accounting
To avoid floating-point rounding errors, all monetary values are processed and stored as positive integers representing paisa (1 PKR = 100 paisa). Conversion to PKR strings happens only at presentation boundaries.

### 2. Multi-Tier Role-Based Access Control
Access control is enforced on the server at the route middleware and database query layers across five roles:

| Role | Code | Responsibility |
|---|---|---|
| Super Administrator | `SUPER_ADMIN` | Full administrative permissions, system configuration, account oversight |
| Finance Reviewer | `FINANCE_REVIEWER` | Review and approval of weekly branch reports and collections |
| Central HR Lead | `HR_LEAD` | Volunteer application intake and member conversion |
| Branch Lead | `BRANCH_LEAD` | Scoped reporting, member tracking and offline collection logging for the assigned branch only |
| Content Editor | `CONTENT_EDITOR` | Drafting and publishing of announcements and public content |

The full permission table is in [`docs/permissions.md`](docs/permissions.md).

### 3. Concurrency Protection and State Transitions
Weekly branch reports follow a formal state machine:

`DRAFT` -> `SUBMITTED` -> `RETURNED` -> `RESUBMITTED` -> `APPROVED` -> `LOCKED`

State changes use row-level locking (`SELECT ... FOR UPDATE`) inside isolated database transactions. When a report is approved, its collections are locked and its metrics are snapshotted into an immutable JSONB structure.

### 4. Database Immutability and Safe Migrations
- Database triggers block any `UPDATE` or `DELETE` on the `audit_logs` table.
- The migration runner uses a `schema_migrations` tracking table and a PostgreSQL advisory lock (`pg_advisory_lock`) to prevent races between multiple instances.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict mode) |
| Framework | Express.js |
| Database | PostgreSQL 16+ |
| Authentication | Stateless JWT (`HS256`, algorithm pinned on verify) |
| Tests | Jest and Supertest (at least 60% line and statement coverage) |
| Containers | Docker and Docker Compose |
| CI / Hosting | GitHub Actions / Render |

---

## Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- PostgreSQL 16, or a Docker runtime

---

## Getting Started

### 1. Environment Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/realHaris-gif/shiplens-platform.git
cd shiplens-platform
npm install
```

Create a local configuration file from the template:

```bash
cp .env.example .env
```

Set these variables in `.env`:

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `DATABASE_URL` | `postgresql://shiplens_user:your_password@localhost:5432/shiplens_db` | PostgreSQL connection string |
| `DB_SSL` | `false` | Set `true` on Render |
| `JWT_SECRET` | (at least 32 random characters) | Token signing key |
| `SEED_PASSWORD` | (optional) | Overrides the default test password |

Never commit `.env`.

### 2. Database Initialization

Run the schema migrations:

```bash
npx ts-node src/db/migrate.ts
```

Seed the default branches, counters and role-based test accounts (this is also the documented step for loading the sample data):

```bash
npm run seed
```

### 3. Test Logins

One account per role. Password for all: `Password123!` (or the value of `SEED_PASSWORD`).

| Role | Email |
|---|---|
| Super Admin | `admin@shiplens.org` |
| Finance Reviewer | `finance@shiplens.org` |
| HR Lead | `hr@shiplens.org` |
| Branch Lead | `lead.lahore@shiplens.org` |
| Content Editor | `editor@shiplens.org` |

### 4. Build and Run

Compile the TypeScript source:

```bash
npm run build
```

Start in production mode:

```bash
npm start
```

Start in development with hot reload:

```bash
npm run dev
```

The app is served at <http://localhost:3000>. Health check: `GET /health`.

---

## Testing and Quality Assurance

The suite covers authentication barriers, cross-branch data isolation, CSV formula-injection neutralisation, concurrent report approval locks and rate limiters.

Run the tests with coverage enforcement (requires a PostgreSQL database reachable through `DATABASE_URL`):

```bash
npm run test:coverage
```

Latest result:

- Suites: 11 passed, 11 total
- Tests: 42 passed, 42 total
- Coverage: at least 60% statements and lines

---

## Docker Deployment

Launch the app together with an isolated PostgreSQL container:

```bash
docker compose up -d --build
```

The Compose definition includes container healthchecks for database connectivity and the `/health` endpoint.

---

## Security Hardening

- **CSV injection defense:** export endpoints prefix cells that start with `=`, `+`, `-`, `@`, tab or carriage return with a single quote (`'`).
- **Timing attack mitigation:** the login path runs a dummy password-hash comparison when the email does not exist, so response times are equalised.
- **Secure response headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Strict-Transport-Security`.
- **Payload control:** JSON request bodies are limited to 100 kb.
- **Rate limiting:** login and public application endpoints are rate limited.
- **Secrets:** read from environment variables only; `.env` is git-ignored.

---

## Documentation

- [Architecture decision records](docs/adr/)
- [API documentation](docs/api.md)
- [Permission table](docs/permissions.md)
- [Handover guide](docs/handover.md)
- [AI usage disclosure](AI-USAGE.md)

---

## License

Released under the [MIT License](LICENSE).