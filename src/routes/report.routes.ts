import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';
import { P } from '../config/permissions';

const router = Router();

router.use(authenticate);

// 1. Specific export routes (MUST come before /:id)
router.get(
  '/export/csv',
  requireRoles(P('reports.csv') as Role[]),
  ReportController.exportCsv
);

router.get(
  '/export/pdf',
  requireRoles(P('reports.pdf') as Role[]),
  ReportController.exportPdf
);

// 2. Collection routes (relative to /reports mount)
router.post(
  '/',
  requireRoles(P('reports.create') as Role[]),
  ReportController.createDraft
);

router.get(
  '/',
  requireRoles(P('reports.list') as Role[]),
  ReportController.list
);

// 3. Dynamic parameterized routes (:id)
router.patch(
  '/:id/submit',
  requireRoles(P('reports.submit') as Role[]),
  ReportController.submit
);

router.patch(
  '/:id/approve',
  requireRoles(P('reports.approve') as Role[]),
  ReportController.approve
);

router.patch(
  '/:id/return',
  requireRoles(P('reports.return') as Role[]),
  ReportController.returnReport
);

export default router;