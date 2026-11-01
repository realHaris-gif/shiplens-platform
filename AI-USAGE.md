# AI Collaboration & Audit Disclosure Log: ShipLens Platform

Prepared for the EchoLens / Participant Handbook Governance Committee.

## 1. Project Ownership & Division of Labor
The core platform architecture, domain model design, business logic implementation, state machine workflows, UI styling, and system integration were designed and implemented by the primary developer (Muhammad Haris). 

Large Language Model tooling (Gemini) was utilized strictly in an advisory and auxiliary testing capacity—acting as a code auditor, test case generator, and verification partner. The developer performed the architectural heavy lifting and implementation, while AI was leveraged to stress-test corner cases, automate regression assertion scaffolding, and verify adherence to the Participant Handbook security and governance requirements.

## 2. Collaborative Verification & Testing Workflow

### Phase 1: Security & Server-Side RBAC
* **Primary Developer Implementation:** 
  * Designed and built the layered controller/service architecture, authentication flows, and central RBAC gate middleware across all 5 organizational roles (`SUPER_ADMIN`, `FINANCE_REVIEWER`, `BRANCH_LEAD`, `HR_LEAD`, `CONTENT_EDITOR`).
  * Enforced branch scoping via `scopedBranchId` to ensure strict tenant isolation.
* **AI Testing & Audit Assistance:** 
  * Audited the express router endpoint table to identify duplicate handler registrations and verify rate-limiter placement.
  * Verified JWT signature verification options, ensuring algorithm pinning (`HS256`) and minimum secret entropy requirements were enforced at boot.

### Phase 2: Financial Integrity, Money Flow & State Machine
* **Primary Developer Implementation:**
  * Implemented positive integer paisa accounting (`1 PKR = 100 Paisa`) to eliminate floating-point IEEE 754 precision drift.
  * Built the multi-step weekly report governance lifecycle (`DRAFT` → `SUBMITTED` → `RETURNED` → `RESUBMITTED` → `APPROVED` → `LOCKED`).
  * Designed atomic database transactions with row-level locks (`SELECT ... FOR UPDATE`) to guarantee audit log writes occur within the exact same transaction as financial mutations.
* **AI Testing & Audit Assistance:**
  * Assisted in formulating edge-case unit and integration tests for concurrent approvals to verify that double-approval race conditions are blocked by Postgres row locks.
  * Verified logic recalculating dynamic totals (`total_amount_paisa`) on state changes to ensure frozen snapshots remain synchronized with approved collections.

### Phase 3: Database Migrations, Immutability & Schema Hardening
* **Primary Developer Implementation:**
  * Created normalized PostgreSQL schemas, sequences for sequential identifiers (`BR-101`, `MEM-1001`), foreign key cascading policies, and before-update/delete audit immutability triggers.
  * Integrated session-level PostgreSQL advisory locks (`pg_advisory_lock`) and the `schema_migrations` tracking table to eliminate deployment race conditions.
* **AI Testing & Audit Assistance:**
  * Tested migration rollback behaviors and validated SQL query execution across local Docker Compose and remote managed PostgreSQL instances.
  * Verified CSV formula injection sanitization logic (`=`, `+`, `-`, `@`, `\t`, `\r`) with single-quote escaping.

### Phase 4: Test Suite & Coverage Verification
* **Primary Developer Implementation:**
  * Wrote and debugged the comprehensive test suite across all controllers, services, and route handlers.
  * Configured GitHub Actions CI pipeline with automated schema migrations, container healthcheck smoke tests, and strict coverage gates.
* **AI Testing & Audit Assistance:**
  * Scaffolding test mocks and validating threshold alignment in `jest.config.js`.
  * Verified that the resulting suite achieved 42/42 passing tests and 67.5% code coverage, surpassing the handbook's 60% requirement.

## 3. Defense Questions Readiness

### Q: Why did you design the data model using integer paisa rather than numeric/floats?
* **Answer:** Floating point arithmetic produces IEEE 754 rounding errors (`0.1 + 0.2 !== 0.3`). By enforcing positive integer paisa at the schema and validation layers (`CHECK (amount_paisa > 0)`), total sums are accurate down to the single Paisa (1 PKR = 100 Paisa) with zero precision loss.

### Q: How does the system prevent a Branch Lead from accessing or tampering with another branch's ledger?
* **Answer:** Multi-layer defense. First, middleware attaches the verified JWT claim. Second, `scopedBranchId(req)` extracts the authenticated user's assigned branch. Third, every write and select locks the row with `FOR UPDATE` and verifies that `row.branch_id === user.branchId`. If a match is not found, the service throws a `404 Not Found` (refusing to leak record existence).

### Q: What prevents race conditions if two reviewers approve a weekly report at the same time?
* **Answer:** Database row-level locks. The report row is queried via `SELECT * FROM weekly_reports WHERE id = $1 FOR UPDATE`. The first reviewer's transaction holds the lock, verifies status `SUBMITTED`, transitions it to `APPROVED`, and writes the audit log. The second transaction waits on the lock; upon acquiring it, it reads `status === APPROVED` and rejects the request with an HTTP 422 error.