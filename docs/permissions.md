# ShipLens System Role & Permission Matrix

> Automatically generated from `src/config/permissions.ts`. Deny-by-default architecture.

| Permission ID | Method | Path | SUPER_ADMIN | FINANCE_REVIEWER | CONTENT_EDITOR | BRANCH_LEAD | HR_LEAD |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `branches.create` | **POST** | `/branches` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `branches.status` | **PATCH** | `/branches/:id/status` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `branches.admin` | **GET** | `/admin/branches` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `collections.add` | **POST** | `/collections` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `collections.edit` | **PATCH** | `/collections/:id` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `collections.lock` | **PATCH** | `/collections/:id/lock` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `collections.xfer` | **PATCH** | `/collections/:id/transfer` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `collections.list` | **GET** | `/collections` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `collections.unrouted` | **GET** | `/collections/unrouted` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `reports.create` | **POST** | `/reports` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `reports.submit` | **PATCH** | `/reports/:id/submit` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `reports.approve` | **PATCH** | `/reports/:id/approve` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.return` | **PATCH** | `/reports/:id/return` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.list` | **GET** | `/reports` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `reports.csv` | **GET** | `/reports/export/csv` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `reports.pdf` | **GET** | `/reports/export/pdf` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `applications.list` | **GET** | `/applications` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `applications.review` | **PATCH** | `/applications/:id/review` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `members.list` | **GET** | `/members` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `members.edit` | **PATCH** | `/members/:id` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `content.list` | **GET** | `/admin/content` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.create` | **POST** | `/admin/content` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.edit` | **PATCH** | `/admin/content/:id` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.publish` | **PATCH** | `/admin/content/:id/publish` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.unpublish` | **PATCH** | `/admin/content/:id/unpublish` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `dashboard.view` | **GET** | `/dashboard` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users.list` | **GET** | `/admin/users` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users.create` | **POST** | `/admin/users` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users.edit` | **PATCH** | `/admin/users/:id` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit.list` | **GET** | `/admin/audit` | ✅ | ❌ | ❌ | ❌ | ❌ |
