import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReportService } from '../services/report.service';
import { scopedBranchId, ScopeError } from '../middleware/scope';

export class ReportController {
  static async createDraft(req: AuthenticatedRequest, res: Response) {
    const { branchId, weekStartDate, weekEndDate, submissionNotes } = req.body;

    if (!branchId || !weekStartDate || !weekEndDate) {
      return res.status(400).json({ error: 'branchId, weekStartDate, and weekEndDate are required' });
    }

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    if (branchScope && branchScope !== branchId) {
      return res.status(403).json({ error: 'Forbidden: Cannot create reports for another branch' });
    }

    try {
      const draft = await ReportService.createDraft(
        { branchId, weekStartDate, weekEndDate, submissionNotes },
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(201).json(draft);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async submit(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const submitted = await ReportService.submitReport(
        id,
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(200).json(submitted);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 422;
      return res.status(status).json({ error: error.message });
    }
  }

  static async approve(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const approved = await ReportService.approveReport(
        id,
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(200).json(approved);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 422;
      return res.status(status).json({ error: error.message });
    }
  }

  static async returnReport(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'rejectionReason is required' });
    }

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const returned = await ReportService.returnReport(
        id,
        rejectionReason,
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(200).json(returned);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 422;
      return res.status(status).json({ error: error.message });
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const reports = await ReportService.listReports({
        branchId: branchScope,
        status: req.query.status as string | undefined,
      });
      return res.status(200).json(reports);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async exportCsv(req: AuthenticatedRequest, res: Response) {
    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const reports = await ReportService.listReports({
        branchId: branchScope,
        status: req.query.status as string | undefined,
      });

      const sanitizeCell = (value: any): string => {
        if (value === null || value === undefined) return '""';
        let str = String(value);

        // Neutralize executable formula injection triggers (=, +, -, @, \t, \r)
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }

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