import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';
import { PdfService } from '../services/pdf.service';
import { ownBranchOrNull, listScope } from '../middleware/scope';

const router = Router();


router.get('/export/pdf', authenticate, async (req, res, next) => {
  try {
    const scope = listScope(req);
    const pdfBuffer = await PdfService.generateReportsPdf(scope);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=shiplens-reports-${Date.now()}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});
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