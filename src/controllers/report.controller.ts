import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReportService } from '../services/report.service';
import { scopedBranchId, ScopeError } from '../middleware/scope';
import PDFDocument from 'pdfkit';

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
      const rawStatus = req.query.status as string | undefined;
      // Handle comma-separated filter: "SUBMITTED,RESUBMITTED"
      const statusArray = rawStatus ? rawStatus.split(',').map((s) => s.trim()) : undefined;

      const reports = await ReportService.listReports({
        branchId: branchScope,
        status: statusArray ? (statusArray.length === 1 ? statusArray[0] : undefined) : undefined,
      });

      // In-memory filter fallback to guarantee comma-separated queries always resolve correctly
      const filtered = statusArray && statusArray.length > 1
        ? reports.filter((r: any) => statusArray.includes(r.status))
        : reports;

      return res.status(200).json(filtered);
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

  static async exportPdf(req: AuthenticatedRequest, res: Response) {
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

      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="shiplens-audit-${new Date().toISOString().split('T')[0]}.pdf"`
      );

      doc.pipe(res);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('ShipLens — Executive Audit Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#555555').text(`Generated: ${new Date().toUTCString()}`, { align: 'center' });
      doc.moveDown(1.2);

      // Aggregate Stats
      const totalPaisa = reports.reduce((acc: number, r: any) => acc + Number(r.total_amount_paisa || 0), 0);
      const totalPkrFormatted = (totalPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text(
        `Total Reports: ${reports.length}   |   Aggregated Volume: PKR ${totalPkrFormatted}`
      );
      doc.moveDown(0.8);

      // Table Header
      const tableTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Report ID', 40, tableTop, { width: 120 });
      doc.text('Period', 170, tableTop, { width: 140 });
      doc.text('Amount (PKR)', 320, tableTop, { width: 100, align: 'right' });
      doc.text('Status', 440, tableTop, { width: 80, align: 'center' });

      doc.moveTo(40, tableTop + 13).lineTo(540, tableTop + 13).strokeColor('#aaaaaa').stroke();

      // Rows
      let y = tableTop + 18;
      doc.font('Helvetica').fontSize(8.5);

      for (const r of reports) {
        if (y > 750) {
          doc.addPage();
          y = 45;
        }

        const pkr = (Number(r.total_amount_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const startStr = String(r.week_start_date || '').slice(0, 10);
        const endStr = String(r.week_end_date || '').slice(0, 10);

        doc.fillColor('#111111');
        doc.text(String(r.id).slice(0, 18), 40, y, { width: 120 });
        doc.text(`${startStr} to ${endStr}`, 170, y, { width: 140 });
        doc.text(pkr, 320, y, { width: 100, align: 'right' });
        doc.text(String(r.status || ''), 440, y, { width: 80, align: 'center' });

        y += 16;
      }

      doc.end();
    } catch (error: any) {
      console.error('PDF generation error:', error);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to generate PDF audit report' });
      }
    }
  }
}