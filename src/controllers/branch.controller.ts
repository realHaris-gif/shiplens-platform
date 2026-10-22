import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { BranchService } from '../services/branch.service';
import { BranchStatus } from '../types';

export class BranchController {
  static async create(req: AuthenticatedRequest, res: Response) {
    const { name, city } = req.body;
    if (!name || !city) {
      return res.status(400).json({ error: 'Name and city are required' });
    }

    try {
      const branch = await BranchService.createBranch(
        { name, city },
        req.user!.userId,
        req.ip
      );
      return res.status(201).json(branch);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(BranchStatus).includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    try {
      const updated = await BranchService.updateBranchStatus(
        id,
        status as BranchStatus,
        req.user!.userId,
        req.ip
      );
      return res.status(200).json(updated);
    } catch (error: any) {
      if (error.message === 'Branch not found') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(422).json({ error: error.message });
    }
  }

  static async list(_req: AuthenticatedRequest, res: Response) {
    try {
      const branches = await BranchService.listBranches();
      return res.status(200).json(branches);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}