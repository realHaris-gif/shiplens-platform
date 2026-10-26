# Role-Based Access Control (RBAC) & Permissions Matrix

ShipLens enforces server-side Role-Based Access Control using JWT verification middleware (`authenticate`) and role-enforcement guards (`requireRoles`).

---

## 1. Role Definitions

| Role Identifier | Description | Operational Scope |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Central Head Office Executive | Nationwide authority across all branches, users, and audit trails. |
| **`FINANCE_REVIEWER`**| HQ Financial Auditor | Reviews weekly branch reports, locks collections, and exports financial records. |
| **`HR_LEAD`** | Human Resources Administrator | Reviews volunteer applications and mints official sequential member IDs. |
| **`BRANCH_LEAD`** | Local Chapter Lead | Manages daily cash collections and weekly reports for their assigned branch. |
| **`CONTENT_EDITOR`** | Communications & Media Officer | Drafts, updates, and publishes bulletins and articles to the public site. |

---

## 2. API Endpoint Permissions Matrix

| Endpoint Route | HTTP Method | Minimum Required Role | Description |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Public | Live database and process uptime probe |
| `/content` | `GET` | Public | Lists all published announcements and bulletins |
| `/branches` | `GET` | Public | Lists active regional branches directory |
| `/applications` | `POST` | Public | Submits a new volunteer intake application |
| `/auth/login` | `POST` | Public | Authenticates credentials and returns JWT token |
| `/admin/content` | `GET` | `CONTENT_EDITOR`, `SUPER_ADMIN` | Lists all content items (drafts + published) |
| `/admin/content` | `POST` | `CONTENT_EDITOR`, `SUPER_ADMIN` | Drafts a new bulletin or announcement |
| `/admin/content/:id/publish` | `PATCH` | `CONTENT_EDITOR`, `SUPER_ADMIN` | Publishes draft item to public portal |
| `/applications` | `GET` | `HR_LEAD`, `SUPER_ADMIN` | Views pending volunteer applications queue |
| `/applications/:id/review`| `PATCH` | `HR_LEAD`, `SUPER_ADMIN` | Accepts/declines application and mints `MEM-1000` |
| `/members` | `GET` | `HR_LEAD`, `SUPER_ADMIN` | Lists all active member rosters |
| `/collections` | `POST` | `BRANCH_LEAD`, `SUPER_ADMIN` | Records daily cash collection (isolated to branch) |
| `/collections` | `GET` | `BRANCH_LEAD`, `SUPER_ADMIN` | Lists recorded collections |
| `/collections/:id` | `PATCH` | `BRANCH_LEAD`, `SUPER_ADMIN` | Updates collection (subject to 7-day rule) |
| `/collections/unrouted` | `GET` | `FINANCE_REVIEWER`, `SUPER_ADMIN` | Lists collections not yet remitted to central account |
| `/reports` | `POST` | `BRANCH_LEAD`, `SUPER_ADMIN` | Drafts a 7-day Monday–Sunday weekly report |
| `/reports/:id/submit` | `PATCH` | `BRANCH_LEAD`, `SUPER_ADMIN` | Submits draft report for Central HQ review |
| `/reports/:id/approve` | `PATCH` | `FINANCE_REVIEWER`, `SUPER_ADMIN` | Approves report and freezes metrics snapshot |
| `/reports/:id/return` | `PATCH` | `FINANCE_REVIEWER`, `SUPER_ADMIN` | Returns report to branch lead with rejection notes |
| `/reports/export/csv` | `GET` | `BRANCH_LEAD`, `FINANCE_REVIEWER`, `SUPER_ADMIN` | Formula-injection-sanitized CSV export |

---

## 3. Strict Boundary Rules

1. **Branch Isolation:** A `BRANCH_LEAD` is strictly barred from logging collections, drafting reports, or reading reports for any `branch_id` other than their own assigned branch (enforced via `req.user.branchId !== branchId` checks).
2. **7-Day Immutability:** Any collection older than 7 calendar days (`diffInDays > 7`) triggers an automatic database lock and rejects further modifications.
3. **Audit Log Append-Only Protection:** Audit entries can never be modified or deleted by any user or application role.