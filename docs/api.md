# ShipLens API Reference Specification

The ShipLens backend provides a RESTful interface for organizational governance, multi-branch operations, volunteer pipeline automation, paisa-precision integer accounting, and append-only audit logging.

- **Base URL (Production):** `https://shiplens-platform.onrender.com`
- **Base URL (Local / Docker):** `http://localhost:3000`
- **Content-Type:** `application/json`
- **Authentication:** Bearer token passed in the `Authorization` header (`Authorization: Bearer <JWT_TOKEN>`)

---

## 1. System & Health

### `GET /health`
Inspects operational vitality, database connectivity, and runtime metrics.

- **Access:** Public
- **Headers:** None required
- **Success Response (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-26T16:56:41.417Z",
    "database": "connected",
    "uptime": 597.29
  }
  ```
- **Error Response (`503 Service Unavailable`):**
  ```json
  {
    "status": "unhealthy",
    "timestamp": "2026-10-26T16:56:41.417Z",
    "database": "disconnected",
    "error": "Connection pool timeout"
  }
  ```

---

## 2. Authentication & Session Management

### `POST /auth/login`
Authenticates registered staff members and issues a signed JSON Web Token (JWT). Throttled to 10 requests per 15-minute window via `loginLimiter`.

- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "admin@shiplens.org",
    "password": "Password123!"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1f7b6b2-65f3-4217-a167-9c9883582498",
      "email": "admin@shiplens.org",
      "name": "Super Admin",
      "role": "SUPER_ADMIN",
      "branch_id": null
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing email or password fields.
  - `401 Unauthorized`: Invalid email or incorrect password.
  - `429 Too Many Requests`: Rate limit exceeded for IP.

---

## 3. Branch Lifecycle & State Machine

### `GET /branches`
Lists all registered organization branches, their current lifecycle state, and assigned branch leadership.

- **Access:** Public
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
      "code": "BR-101",
      "name": "Lahore Central",
      "city": "Lahore",
      "status": "ACTIVE",
      "lead_user_id": "8a04b123-d34e-48a6-9f17-d2780e550e21",
      "lead_name": "Tariq Mahmood",
      "created_at": "2026-10-21T08:00:00.000Z"
    }
  ]
  ```

### `POST /branches`
Registers a new regional branch in initial `FORMING` status with an auto-generated sequential branch code (`BR-XXX`).

- **Access:** `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "name": "Rawalpindi North",
    "city": "Rawalpindi",
    "lead_user_id": "8a04b123-d34e-48a6-9f17-d2780e550e21"
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "id": "2d8f990a-1123-4567-89ab-cdef01234567",
    "code": "BR-104",
    "name": "Rawalpindi North",
    "city": "Rawalpindi",
    "status": "FORMING",
    "lead_user_id": "8a04b123-d34e-48a6-9f17-d2780e550e21",
    "created_at": "2026-10-26T21:00:00.000Z"
  }
  ```

### `PATCH /branches/:id/status`
Executes valid state machine transitions: $\text{FORMING} \rightarrow \text{ACTIVE} \rightarrow \text{PROBATION} \rightarrow \text{CLOSED}$. Terminal `CLOSED` state transitions cannot be reversed.

- **Access:** `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "status": "ACTIVE"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "2d8f990a-1123-4567-89ab-cdef01234567",
    "code": "BR-104",
    "status": "ACTIVE",
    "updated_at": "2026-10-26T21:05:00.000Z"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Transition rejected (e.g., attempting to activate without an assigned `lead_user_id`, or attempting to reopen a `CLOSED` branch).

---

## 4. Volunteer Intake & Member Conversion

### `POST /applications`
Submits a public volunteer registration application. Throttled via `applicationLimiter` (20 submissions per hour per IP).

- **Access:** Public
- **Request Body:**
  ```json
  {
    "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
    "name": "Hamza Abbasi",
    "email": "hamza.abbasi@example.com",
    "phone": "03007654321",
    "skills": "Inventory Logistics, First Aid",
    "notes": "Available on weekends."
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "id": "55c4d098-b80c-4ec7-92d6-44dbca8711e1",
    "status": "PENDING",
    "message": "Application submitted successfully."
  }
  ```

### `GET /applications`
Retrieves pending, reviewed, and converted volunteer applications.

- **Access:** `SUPER_ADMIN`, `HR_LEAD`
- **Query Parameters:** `?status=PENDING|ACCEPTED|REJECTED`
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "55c4d098-b80c-4ec7-92d6-44dbca8711e1",
      "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
      "branch_name": "Lahore Central",
      "name": "Hamza Abbasi",
      "email": "hamza.abbasi@example.com",
      "phone": "03007654321",
      "skills": "Inventory Logistics, First Aid",
      "status": "PENDING",
      "created_at": "2026-10-26T21:10:00.000Z"
    }
  ]
  ```

### `PATCH /applications/:id/decision`
Accepts or rejects an application. When accepted, automatically provisions an active member record with an immutable sequential code (`MEM-1001` series).

- **Access:** `SUPER_ADMIN`, `HR_LEAD`
- **Request Body:**
  ```json
  {
    "status": "ACCEPTED"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "application_id": "55c4d098-b80c-4ec7-92d6-44dbca8711e1",
    "status": "ACCEPTED",
    "member": {
      "id": "aa123456-789b-cdef-0123-456789abcdef",
      "code": "MEM-1001",
      "name": "Hamza Abbasi",
      "email": "hamza.abbasi@example.com",
      "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
      "status": "ACTIVE"
    }
  }
  ```

### `GET /members`
Returns the active member directory.

- **Access:** All Authenticated Staff
- **Query Parameters:** `?branch_id=uuid&search=query`
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "aa123456-789b-cdef-0123-456789abcdef",
      "code": "MEM-1001",
      "name": "Hamza Abbasi",
      "email": "hamza.abbasi@example.com",
      "phone": "03007654321",
      "branch_name": "Lahore Central",
      "status": "ACTIVE",
      "joined_at": "2026-10-26T21:12:00.000Z"
    }
  ]
  ```

---

## 5. Offline Collections & Paisa Financial Ledger

> **Financial Modeling Standard:** Floating-point monetary calculations are strictly prohibited. Amounts are parsed and stored as 64-bit integer Paisa ($1\text{ PKR} = 100\text{ Paisa}$). Decimal calculations occur exclusively at the presentation layer.

### `POST /collections`
Records an offline cash or field donation collection.

- **Access:** `BRANCH_LEAD`, `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
    "amount_paisa": 2500000,
    "collection_date": "2026-10-26",
    "source": "Zakat Counter Box 01",
    "receipt_number": "REC-77821"
  }
  ```
  *(Note: `2500000` Paisa corresponds to `25,000.00 PKR`)*
- **Success Response (`201 Created`):**
  ```json
  {
    "id": "f10e4b88-1234-5678-9abc-def012345678",
    "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
    "amount_paisa": 2500000,
    "collection_date": "2026-10-26",
    "status": "UNLOCKED",
    "source": "Zakat Counter Box 01",
    "receipt_number": "REC-77821",
    "recorded_by": "8a04b123-d34e-48a6-9f17-d2780e550e21",
    "created_at": "2026-10-26T21:15:00.000Z"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Non-integer paisa amount provided (floating points rejected).
  - `403 Forbidden`: `BRANCH_LEAD` attempting to submit collections for a different branch.

### `GET /collections`
Fetches collections filtered by branch, date range, or audit lock status.

- **Access:** `FINANCE_REVIEWER`, `SUPER_ADMIN`, `BRANCH_LEAD` (scoped to assigned branch)
- **Query Parameters:** `?branch_id=uuid&status=UNLOCKED|LOCKED|TRANSFERRED`
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "f10e4b88-1234-5678-9abc-def012345678",
      "amount_paisa": 2500000,
      "collection_date": "2026-10-26",
      "source": "Zakat Counter Box 01",
      "receipt_number": "REC-77821",
      "status": "UNLOCKED",
      "is_locked": false,
      "branch_code": "BR-101"
    }
  ]
  ```

### `PATCH /collections/:id/lock`
Locks a collection entry to prevent further edits or tampering (enforced automatically after 7 days or on demand by Finance).

- **Access:** `FINANCE_REVIEWER`, `SUPER_ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "f10e4b88-1234-5678-9abc-def012345678",
    "status": "LOCKED",
    "locked_at": "2026-10-26T21:18:00.000Z",
    "locked_by": "c1f7b6b2-65f3-4217-a167-9c9883582498"
  }
  ```

### `GET /collections/export.csv`
Streams a comma-separated values (CSV) export of collections. All user-supplied string fields are sanitized against CSV formula injection (values beginning with `=`, `+`, `-`, or `@` are prefixed with `'`).

- **Access:** `FINANCE_REVIEWER`, `SUPER_ADMIN`
- **Headers:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="collections_export.csv"`
- **Response Format:**
  ```csv
  ID,Branch,Amount_Paisa,Amount_PKR,Date,Source,Receipt_Number,Status
  "f10e4b88","Lahore Central",2500000,"25000.00","2026-10-26","Zakat Counter Box 01","'REC-77821","LOCKED"
  ```

---

## 6. Weekly Reports & Frozen Metrics Architecture

### `POST /reports/draft`
Aggregates recorded branch collections and metrics within a 7-day reporting window into a working draft.

- **Access:** `BRANCH_LEAD`, `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
    "week_start": "2026-10-19",
    "week_end": "2026-10-25"
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "id": "77bb3311-00aa-44cc-88ee-1234567890ab",
    "branch_id": "e4f80164-9be1-4b2e-a3d8-57d42cf38a44",
    "week_number": 43,
    "year": 2026,
    "status": "DRAFT",
    "total_collections_paisa": 12500000,
    "collection_count": 14,
    "created_at": "2026-10-26T21:20:00.000Z"
  }
  ```

### `PATCH /reports/:id/submit`
Transitions report status from `DRAFT` or `RETURNED` to `SUBMITTED`, queueing it for HQ Finance audit.

- **Access:** `BRANCH_LEAD`, `SUPER_ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "77bb3311-00aa-44cc-88ee-1234567890ab",
    "status": "SUBMITTED",
    "submitted_at": "2026-10-26T21:22:00.000Z"
  }
  ```

### `PATCH /reports/:id/approve`
Approves the report and generates an immutable JSONB snapshot (`frozen_metrics`). Once approved, historical figures remain unchanged regardless of subsequent ledger entries.

- **Access:** `FINANCE_REVIEWER`, `SUPER_ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "77bb3311-00aa-44cc-88ee-1234567890ab",
    "status": "APPROVED",
    "approved_by": "f2a1b3c4-d5e6-7890-abcd-ef1234567890",
    "frozen_metrics": {
      "total_collections_paisa": 12500000,
      "collection_count": 14,
      "currency": "PKR",
      "paisa_ratio": 100,
      "locked_at": "2026-10-26T21:25:00.000Z"
    }
  }
  ```

### `PATCH /reports/:id/return`
Rejects a submitted report back to the branch lead for correction. Requires an audit rejection reason.

- **Access:** `FINANCE_REVIEWER`, `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "rejection_reason": "Missing receipt documentation for October 22 cash box batch."
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "77bb3311-00aa-44cc-88ee-1234567890ab",
    "status": "RETURNED",
    "rejection_reason": "Missing receipt documentation for October 22 cash box batch."
  }
  ```

---

## 7. Content Management System (CMS) & Public Bulletins

### `GET /content`
Serves published bulletins, announcements, and events to the public SPA.

- **Access:** Public
- **Query Parameters:** `?category=ANNOUNCEMENT|EVENT|NEWS`
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "33a1b2c3-4d5e-6f70-8192-abcdef012345",
      "title": "Winter Flood Preparedness Drive",
      "category": "ANNOUNCEMENT",
      "summary": "Coordinated relief readiness across southern branches.",
      "body": "Volunteer distribution kits are now staged at Multan and Lahore...",
      "status": "PUBLISHED",
      "published_at": "2026-10-25T10:00:00.000Z"
    }
  ]
  ```

### `POST /admin/content`
Drafts a new communication item.

- **Access:** `CONTENT_EDITOR`, `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "title": "Q4 Medical Camp Dates Announced",
    "category": "EVENT",
    "summary": "Free diagnostic clinics hosted across 3 regional branches.",
    "body": "Detailed schedule and volunteer duties can be accessed below..."
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "id": "99def012-3456-789a-bcde-f0123456789a",
    "title": "Q4 Medical Camp Dates Announced",
    "category": "EVENT",
    "status": "DRAFT",
    "created_at": "2026-10-26T21:30:00.000Z"
  }
  ```

### `PATCH /admin/content/:id/publish`
Publishes a drafted bulletin, making it instantly accessible in the public feed.

- **Access:** `CONTENT_EDITOR`, `SUPER_ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "99def012-3456-789a-bcde-f0123456789a",
    "status": "PUBLISHED",
    "published_at": "2026-10-26T21:32:00.000Z"
  }
  ```

### `PATCH /admin/content/:id/unpublish`
Reverts a published item to `DRAFT` status, removing it from the public feed.

- **Access:** `CONTENT_EDITOR`, `SUPER_ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "99def012-3456-789a-bcde-f0123456789a",
    "status": "DRAFT"
  }
  ```

---

## 8. Append-Only Audit Trail

> **Database Security Invariant:** The `audit_logs` table is strictly append-only. PostgreSQL engine triggers raise an exception on any attempt to execute `UPDATE` or `DELETE` statements on audit rows (`SQLSTATE P0001: Audit trail records are immutable and cannot be updated or deleted.`).

### `GET /admin/audit-logs`
Provides an inspectable compliance ledger of all administrative and financial actions.

- **Access:** `SUPER_ADMIN`
- **Query Parameters:** `?limit=50&offset=0&entity_type=BRANCH|COLLECTION|REPORT`
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": 1420,
      "actor_id": "c1f7b6b2-65f3-4217-a167-9c9883582498",
      "action": "REPORT_APPROVE",
      "entity_type": "REPORT",
      "record_id": "77bb3311-00aa-44cc-88ee-1234567890ab",
      "before_state": { "status": "SUBMITTED" },
      "after_state": { "status": "APPROVED" },
      "timestamp": "2026-10-26T21:25:00.000Z"
    }
  ]
  ```

---

## 9. Error Response Standards

All rejected requests adhere to a standard JSON error envelope:

```json
{
  "error": "Descriptive error message indicating the rule violation."
}
```

### HTTP Status Codes

| HTTP Status Code | Scenario |
| :--- | :--- |
| **`400 Bad Request`** | Missing required fields, malformed JSON, or non-integer currency inputs. |
| **`401 Unauthorized`** | Missing or invalid Bearer JWT token. |
| **`403 Forbidden`** | Valid token provided, but role lacks required permissions (RBAC denial). |
| **`404 Not Found`** | Requested entity ID does not exist. |
| **`429 Too Many Requests`** | IP rate limit exceeded on throttled public/auth routes. |
| **`500 Internal Server Error`** | Database connection errors or unexpected unhandled server exceptions. |