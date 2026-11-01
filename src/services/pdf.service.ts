// src/services/pdf.service.ts
import PDFDocument from 'pdfkit';
import { ReportService } from './report.service';

export class PdfService {
  static async generateReportsPdf(scope: string | null): Promise<Buffer> {
    const reports = await ReportService.listReports({ branchId: scope });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Title & Header
      doc.fontSize(20).text('ShipLens — Weekly Reports Audit', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#666666').text(
        `Generated on: ${new Date().toISOString()} | Pakistan Time: Asia/Karachi`,
        { align: 'center' }
      );
      doc.moveDown(1.5);

      // Table Header
      doc.fontSize(10).fillColor('#000000');
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Report ID', 40, tableTop);
      doc.text('Period', 150, tableTop);
      doc.text('Amount (PKR)', 330, tableTop);
      doc.text('Status', 460, tableTop);
      doc.moveDown(0.5);
      doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Rows
      doc.font('Helvetica');
      let totalPaisa = 0n;

      reports.forEach((r: any) => {
        if (doc.y > 750) doc.addPage();

        const currentY = doc.y;
        const idDisplay = `${String(r.id).slice(0, 8)}...`;
        const start = (r.week_start_date ? String(r.week_start_date) : '').split('T')[0];
        const end = (r.week_end_date ? String(r.week_end_date) : '').split('T')[0];
        const pkr = (Number(r.total_amount_paisa) / 100).toLocaleString(undefined, {
          minimumFractionDigits: 2
        });

        totalPaisa += BigInt(r.total_amount_paisa || 0);

        doc.text(idDisplay, 40, currentY);
        doc.text(`${start} to ${end}`, 150, currentY);
        doc.text(pkr, 330, currentY);
        doc.text(r.status, 460, currentY);
        doc.moveDown(0.6);
      });

      // Total Line
      doc.moveDown(1);
      doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold');
      const totalPkr = (Number(totalPaisa) / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2
      });
      doc.text(`Total Aggregated Collections: PKR ${totalPkr}`, 40, doc.y, { align: 'right' });

      doc.end();
    });
  }
}