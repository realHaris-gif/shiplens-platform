import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CollectionService } from '../services/collection.service';
import { Role } from '../types';

export class CollectionController {
  static async record(req: AuthenticatedRequest, res: Response) {
    const { branchId, amountPaisa, collectionDate } = req.body;

    if (!branchId || amountPaisa === undefined || !collectionDate) {
      return res.status(400).json({ error: 'branchId, amountPaisa, and collectionDate are required' });
    }

    // Branch isolation: A BRANCH_LEAD can only log for their assigned branch
    if (req.user?.role === Role.BRANCH_LEAD && req.user.branchId !== branchId) {
      return res.status(403).json({ error: 'Forbidden: Cannot record collections for another branch' });
    }

    try {
      const record = await CollectionService.recordCollection(
        { branchId, amountPaisa, collectionDate },
        req.user!.userId,
        req.ip
      );
      return res.status(201).json(record);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async lock(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const locked = await CollectionService.lockCollection(id, req.user!.userId, req.ip);
      return res.status(200).json(locked);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async transfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const transferred = await CollectionService.markTransferred(id, req.user!.userId, req.ip);
      return res.status(200).json(transferred);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    let branchId = req.query.branchId as string | undefined;

    // Enforce branch isolation for branch leads
    if (req.user?.role === Role.BRANCH_LEAD) {
      branchId = req.user.branchId || undefined;
    }

    try {
      const collections = await CollectionService.listCollections(branchId);
      return res.status(200).json(collections);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}