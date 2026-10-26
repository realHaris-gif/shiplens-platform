import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReportService } from '../services/report.service';
import { Role } from '../types';

export class ReportController {
  static async createDraft(req: AuthenticatedRequest, res: Response) {
    const { branchId, weekStartDate, weekEndDate, submissionNotes } = req.body;

    if (!branchId || !weekStartDate || !weekEndDate) {
      return res.status(400).json({ error: 'branchId, weekStartDate, and weekEndDate are required' });
    }

    // Pre-flight Date Validation
    const start = new Date(weekStartDate);
    const end = new Date(weekEndDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for weekStartDate or weekEndDate' });
    }

    if (end < start) {
      return res.status(400).json({ error: 'Week End Date cannot be earlier than Week Start Date' });
    }

    if (req.user?.role === Role.BRANCH_LEAD && req.user.branchId !== branchId) {
      return res.status(403).json({ error: 'Forbidden: Cannot create reports for another branch' });
    }

    try {
      const draft = await ReportService.createDraft(
        { branchId, weekStartDate, weekEndDate, submissionNotes },
        req.user!.userId,
        req.ip
      );
      return res.status(201).json(draft);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async submit(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const submitted = await ReportService.submitReport(id, req.user!.userId, req.ip);
      return res.status(200).json(submitted);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async approve(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const approved = await ReportService.approveReport(id, req.user!.userId, req.ip);
      return res.status(200).json(approved);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async returnReport(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'rejectionReason is required' });
    }

    try {
      const returned = await ReportService.returnReport(
        id,
        rejectionReason,
        req.user!.userId,
        req.ip
      );
      return res.status(200).json(returned);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    let branchId = req.query.branchId as string | undefined;

    if (req.user?.role === Role.BRANCH_LEAD) {
      branchId = req.user.branchId || undefined;
    }

    try {
      const reports = await ReportService.listReports({
        branchId,
        status: req.query.status as string | undefined,
      });
      return res.status(200).json(reports);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
  // Append this method inside ReportController in src/controllers/report.controller.ts

  static async exportCsv(req: AuthenticatedRequest, res: Response) {
    let branchId = req.query.branchId as string | undefined;

    if (req.user?.role === Role.BRANCH_LEAD) {
      branchId = req.user.branchId || undefined;
    }

    try {
      const reports = await ReportService.listReports({
        branchId,
        status: req.query.status as string | undefined,
      });

      // Helper function to sanitize against CSV / Formula Injection
      const sanitizeCell = (value: any): string => {
        if (value === null || value === undefined) return '""';
        let str = String(value);

        // Neutralize executable formula triggers (=, +, -, @, tabs)
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }

        // Escape double quotes and enclose in quotes
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = [
        'Report ID',
        'Branch ID',
        'Week Start Date',
        'Week End Date',
        'Total Collections (PKR)',
        'Total Paisa',
        'Status',
        'Submission Notes',
        'Rejection Reason',
        'Created At',
      ];

      const csvRows = [headers.join(',')];

      for (const r of reports) {
        const pkr = (Number(r.total_amount_paisa) / 100).toFixed(2);
        const row = [
          sanitizeCell(r.id),
          sanitizeCell(r.branch_id),
          sanitizeCell(r.week_start_date),
          sanitizeCell(r.week_end_date),
          sanitizeCell(pkr),
          sanitizeCell(r.total_amount_paisa),
          sanitizeCell(r.status),
          sanitizeCell(r.submission_notes || ''),
          sanitizeCell(r.rejection_reason || ''),
          sanitizeCell(r.created_at),
        ];
        csvRows.push(row.join(','));
      }

      const csvData = csvRows.join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="shiplens-reports-${new Date().toISOString().split('T')[0]}.csv"`
      );
      return res.status(200).send(csvData);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}