import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Apply authentication to all report endpoints
router.use(authenticate);

// 1. Specific export endpoints (Placed FIRST so ':id' never intercepts them)
router.get(
  '/reports/export/csv',
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  ReportController.exportCsv
);

router.get(
  '/reports/export/pdf',
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  ReportController.exportPdf
);

// 2. Collection endpoints
router.post(
  '/reports',
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  ReportController.createDraft
);

router.get(
  '/reports',
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  ReportController.list
);

// 3. Dynamic parameter endpoints
router.patch(
  '/reports/:id/submit',
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  ReportController.submit
);

router.patch(
  '/reports/:id/approve',
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  ReportController.approve
);

router.patch(
  '/reports/:id/return',
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  ReportController.returnReport
);

export default router;