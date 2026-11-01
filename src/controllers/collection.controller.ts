import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CollectionService } from '../services/collection.service';
import { scopedBranchId, ScopeError } from '../middleware/scope';

export class CollectionController {
  static async record(req: AuthenticatedRequest, res: Response) {
    const { branchId, amountPaisa, collectionDate } = req.body;

    if (!branchId || amountPaisa === undefined || !collectionDate) {
      return res.status(400).json({ error: 'branchId, amountPaisa, and collectionDate are required' });
    }

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    if (branchScope && branchScope !== branchId) {
      return res.status(403).json({ error: 'Forbidden: Cannot record collections for another branch' });
    }

    try {
      const record = await CollectionService.recordCollection(
        { branchId, amountPaisa: Number(amountPaisa), collectionDate },
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(201).json(record);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { amountPaisa, collectionDate } = req.body;

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const updated = await CollectionService.updateCollection(
        id,
        {
          amountPaisa: amountPaisa !== undefined ? Number(amountPaisa) : undefined,
          collectionDate,
        },
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(200).json(updated);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 422;
      return res.status(status).json({ error: error.message });
    }
  }

  static async lock(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const locked = await CollectionService.lockCollection(
        id,
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(200).json(locked);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 422;
      return res.status(status).json({ error: error.message });
    }
  }

  static async transfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const transferred = await CollectionService.markTransferred(
        id,
        req.user!.userId,
        branchScope,
        req.ip
      );
      return res.status(200).json(transferred);
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
      const collections = await CollectionService.listCollections(branchScope);
      return res.status(200).json(collections);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async listUnrouted(req: AuthenticatedRequest, res: Response) {
    let branchScope: string | null = null;
    try {
      branchScope = scopedBranchId(req);
    } catch (err: any) {
      return res.status(err instanceof ScopeError ? err.statusCode : 403).json({ error: err.message });
    }

    try {
      const unrouted = await CollectionService.listUnroutedCollections(branchScope);
      return res.status(200).json(unrouted);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}