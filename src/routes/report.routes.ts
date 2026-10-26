import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Draft and submit reports
router.post(
  '/reports',
  authenticate,
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  ReportController.createDraft
);

router.patch(
  '/reports/:id/submit',
  authenticate,
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  ReportController.submit
);

// Review and approve (Finance / Admin)
router.patch(
  '/reports/:id/approve',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  ReportController.approve
);

router.patch(
  '/reports/:id/return',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  ReportController.returnReport
);

// CSV Export with formula injection protection
router.get(
  '/reports/export/csv',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  ReportController.exportCsv
);

// List reports
router.get(
  '/reports',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  ReportController.list
);

export default router;