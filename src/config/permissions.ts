// src/config/permissions.ts
export const Roles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FINANCE_REVIEWER: 'FINANCE_REVIEWER',
  CONTENT_EDITOR: 'CONTENT_EDITOR',
  BRANCH_LEAD: 'BRANCH_LEAD',
  HR_LEAD: 'HR_LEAD'
} as const;

export type RoleType = (typeof Roles)[keyof typeof Roles];

export interface RoutePermission {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  roles: readonly RoleType[];
}

export const PERMISSIONS: readonly RoutePermission[] = [
  // Branches
  { id: 'branches.create', method: 'POST', path: '/branches', roles: [Roles.SUPER_ADMIN] },
  { id: 'branches.status', method: 'PATCH', path: '/branches/:id/status', roles: [Roles.SUPER_ADMIN] },
  { id: 'branches.admin', method: 'GET', path: '/admin/branches', roles: [Roles.SUPER_ADMIN] },

  // Collections
  { id: 'collections.add', method: 'POST', path: '/collections', roles: [Roles.BRANCH_LEAD, Roles.SUPER_ADMIN] },
  { id: 'collections.edit', method: 'PATCH', path: '/collections/:id', roles: [Roles.BRANCH_LEAD, Roles.SUPER_ADMIN] },
  { id: 'collections.lock', method: 'PATCH', path: '/collections/:id/lock', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER] },
  { id: 'collections.xfer', method: 'PATCH', path: '/collections/:id/transfer', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER] },
  { id: 'collections.list', method: 'GET', path: '/collections', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER, Roles.BRANCH_LEAD] },
  { id: 'collections.unrouted', method: 'GET', path: '/collections/unrouted', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER, Roles.BRANCH_LEAD] },

  // Reports
  { id: 'reports.create', method: 'POST', path: '/reports', roles: [Roles.BRANCH_LEAD, Roles.SUPER_ADMIN] },
  { id: 'reports.submit', method: 'PATCH', path: '/reports/:id/submit', roles: [Roles.BRANCH_LEAD, Roles.SUPER_ADMIN] },
  { id: 'reports.approve', method: 'PATCH', path: '/reports/:id/approve', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER] },
  { id: 'reports.return', method: 'PATCH', path: '/reports/:id/return', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER] },
  { id: 'reports.list', method: 'GET', path: '/reports', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER, Roles.BRANCH_LEAD] },
  { id: 'reports.csv', method: 'GET', path: '/reports/export/csv', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER, Roles.BRANCH_LEAD] },
  { id: 'reports.pdf', method: 'GET', path: '/reports/export/pdf', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER, Roles.BRANCH_LEAD] },

  // Volunteer Applications & Members
  { id: 'applications.list', method: 'GET', path: '/applications', roles: [Roles.SUPER_ADMIN, Roles.HR_LEAD] },
  { id: 'applications.review', method: 'PATCH', path: '/applications/:id/review', roles: [Roles.SUPER_ADMIN, Roles.HR_LEAD] },
  { id: 'members.list', method: 'GET', path: '/members', roles: [Roles.SUPER_ADMIN, Roles.HR_LEAD, Roles.BRANCH_LEAD] },
  { id: 'members.edit', method: 'PATCH', path: '/members/:id', roles: [Roles.SUPER_ADMIN, Roles.HR_LEAD] },

  // Content (CMS)
  { id: 'content.list', method: 'GET', path: '/admin/content', roles: [Roles.SUPER_ADMIN, Roles.CONTENT_EDITOR] },
  { id: 'content.create', method: 'POST', path: '/admin/content', roles: [Roles.SUPER_ADMIN, Roles.CONTENT_EDITOR] },
  { id: 'content.edit', method: 'PATCH', path: '/admin/content/:id', roles: [Roles.SUPER_ADMIN, Roles.CONTENT_EDITOR] },
  { id: 'content.publish', method: 'PATCH', path: '/admin/content/:id/publish', roles: [Roles.SUPER_ADMIN, Roles.CONTENT_EDITOR] },
  { id: 'content.unpublish', method: 'PATCH', path: '/admin/content/:id/unpublish', roles: [Roles.SUPER_ADMIN, Roles.CONTENT_EDITOR] },

  // Executive Dashboard
  { id: 'dashboard.view', method: 'GET', path: '/dashboard', roles: [Roles.SUPER_ADMIN, Roles.FINANCE_REVIEWER] },

  // Users & Audit Logs
  { id: 'users.list', method: 'GET', path: '/admin/users', roles: [Roles.SUPER_ADMIN] },
  { id: 'users.create', method: 'POST', path: '/admin/users', roles: [Roles.SUPER_ADMIN] },
  { id: 'users.edit', method: 'PATCH', path: '/admin/users/:id', roles: [Roles.SUPER_ADMIN] },
  { id: 'audit.list', method: 'GET', path: '/admin/audit', roles: [Roles.SUPER_ADMIN] }
] as const;

export function P(permissionId: string): readonly RoleType[] {
  const perm = PERMISSIONS.find((p) => p.id === permissionId);
  if (!perm) throw new Error(`Permission ID '${permissionId}' not found in registry`);
  return perm.roles;
}