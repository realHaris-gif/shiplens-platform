import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { pool } from '../config/db';

export class DashboardController {
  /**
   * GET /dashboard
   * Returns executive KPIs, frozen financial metrics, unrouted collections, and Karachi monthly trends.
   * Authorized for: SUPER_ADMIN, FINANCE_REVIEWER
   */
  static async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      // 1. Frozen Approved Total Paisa
      const approvedRes = await pool.query(
        `SELECT COALESCE(SUM(total_amount_paisa), 0) AS total_paisa
         FROM weekly_reports
         WHERE status = 'APPROVED'`
      );

      // 2. Pending Submission Total Paisa
      const pendingRes = await pool.query(
        `SELECT COALESCE(SUM(total_amount_paisa), 0) AS total_paisa,
                COUNT(*)::int AS count
         FROM weekly_reports
         WHERE status IN ('SUBMITTED', 'RESUBMITTED')`
      );

      // 3. Unrouted Collections (not yet remitted to central account)
      const unroutedRes = await pool.query(
        `SELECT COALESCE(SUM(amount_paisa), 0) AS total_paisa,
                COUNT(*)::int AS count
         FROM collections
         WHERE is_sent_to_main_account = false`
      );

      // 4. Per-Branch Breakdown
      const branchRes = await pool.query(
        `SELECT 
           b.id,
           b.code,
           b.name,
           b.city,
           b.status,
           COALESCE(SUM(r.total_amount_paisa), 0) AS approved_paisa,
           COUNT(r.id)::int AS approved_reports_count
         FROM branches b
         LEFT JOIN weekly_reports r 
           ON r.branch_id = b.id AND r.status = 'APPROVED'
         GROUP BY b.id, b.code, b.name, b.city, b.status
         ORDER BY b.code ASC`
      );

      // 5. Monthly Trends (Grouped in Asia/Karachi time zone)
      const trendsRes = await pool.query(
        `SELECT 
           TO_CHAR(timezone('Asia/Karachi', week_start_date), 'YYYY-MM') AS month,
           COALESCE(SUM(total_amount_paisa), 0) AS total_paisa,
           COUNT(*)::int AS reports_count
         FROM weekly_reports
         WHERE status = 'APPROVED'
         GROUP BY 1
         ORDER BY 1 DESC
         LIMIT 12`
      );

      const approvedPaisa = approvedRes.rows[0].total_paisa.toString();
      const pendingPaisa = pendingRes.rows[0].total_paisa.toString();
      const unroutedPaisa = unroutedRes.rows[0].total_paisa.toString();

      return res.status(200).json({
        summary: {
          approvedPaisa,
          approvedPkr: (Number(approvedPaisa) / 100).toFixed(2),
          pendingPaisa,
          pendingPkr: (Number(pendingPaisa) / 100).toFixed(2),
          pendingReportsCount: pendingRes.rows[0].count,
          unroutedCollectionsCount: unroutedRes.rows[0].count,
          unroutedPaisa,
          unroutedPkr: (Number(unroutedPaisa) / 100).toFixed(2),
        },
        branches: branchRes.rows.map((row: any) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          city: row.city,
          status: row.status,
          approvedPaisa: row.approved_paisa.toString(),
          approvedPkr: (Number(row.approved_paisa) / 100).toFixed(2),
          approvedReportsCount: row.approved_reports_count,
        })),
        monthlyTrends: trendsRes.rows.map((t: any) => ({
          month: t.month,
          totalPaisa: t.total_paisa.toString(),
          totalPkr: (Number(t.total_paisa) / 100).toFixed(2),
          reportsCount: t.reports_count,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate dashboard metrics' });
    }
  }
}