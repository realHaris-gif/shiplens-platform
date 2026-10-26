import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ContentService } from '../services/content.service';

export class ContentController {
  // Public action
  static async getPublic(req: Request, res: Response) {
    try {
      const category = req.query.category as string | undefined;
      const items = await ContentService.listPublicContent(category);
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Editor actions
  static async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const category = req.query.category as string | undefined;
      const items = await ContentService.listAllContent(category);
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    const { title, summary, body, category, slug } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    try {
      const item = await ContentService.createDraft(
        { title, summary, body, category, slug },
        req.user!.userId,
        req.ip
      );
      return res.status(201).json(item);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { title, summary, body, category, slug } = req.body;

    try {
      const item = await ContentService.updateContent(
        id,
        { title, summary, body, category, slug },
        req.user!.userId,
        req.ip
      );
      return res.status(200).json(item);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async publish(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const item = await ContentService.publishContent(id, req.user!.userId, req.ip);
      return res.status(200).json(item);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }

  static async unpublish(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const item = await ContentService.unpublishContent(id, req.user!.userId, req.ip);
      return res.status(200).json(item);
    } catch (error: any) {
      return res.status(422).json({ error: error.message });
    }
  }
}