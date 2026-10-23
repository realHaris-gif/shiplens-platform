import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { MemberService } from '../services/member.service';

export class MemberController {
  static async apply(req: Request, res: Response) {
    const { fullName, email, phone, preferredBranchId, notes } = req.body;
    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'fullName, email, and phone are required' });
    }

    try {
      const application = await MemberService.apply(
        { fullName, email, phone, preferredBranchId, notes },
        req.ip
      );
      return res.status(201).json(application);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async listApplications(req: AuthenticatedRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const applications = await MemberService.listApplications(status);
      return res.status(200).json(applications);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async reviewApplication(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, assignedBranchId, rejectionReason } = req.body;

    if (!status || !['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (ACCEPTED or DECLINED) is required' });
    }

    try {
      const result = await MemberService.reviewApplication(
        id,
        status,
        req.user!.userId,
        assignedBranchId,
        rejectionReason,
        req.ip
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async listMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const branchId = req.query.branchId as string | undefined;
      const members = await MemberService.listMembers(branchId);
      return res.status(200).json(members);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}