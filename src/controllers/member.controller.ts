import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { MemberService } from '../services/member.service';
import { ApplicationStatus } from '../types';

export class MemberController {
  static async apply(req: Request, res: Response) {
    const { fullName, email, phone, preferredBranchId, notes } = req.body;
    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'fullName, email, and phone are required' });
    }

    try {
      const app = await MemberService.submitApplication(
        { fullName, email, phone, preferredBranchId, notes },
        req.ip
      );
      return res.status(201).json(app);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async review(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, assignedBranchId } = req.body;

    if (![ApplicationStatus.ACCEPTED, ApplicationStatus.DECLINED].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACCEPTED or DECLINED' });
    }

    try {
      const result = await MemberService.reviewApplication(
        id,
        status,
        req.user!.userId,
        assignedBranchId,
        req.ip
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async listMembers(req: AuthenticatedRequest, res: Response) {
    const { branchId, search } = req.query;
    try {
      const members = await MemberService.listMembers({
        branchId: branchId as string | undefined,
        search: search as string | undefined,
      });
      return res.status(200).json(members);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
  static async listApplications(req: AuthenticatedRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const apps = await MemberService.listApplications(status);
      return res.status(200).json(apps);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}