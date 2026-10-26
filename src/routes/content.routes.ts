import { Router } from 'express';
import { ContentController } from '../controllers/content.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Public: View published articles & announcements
router.get('/content', ContentController.getPublic);

// Protected: Content Editor / Super Admin management
router.get(
  '/admin/content',
  authenticate,
  requireRoles([Role.CONTENT_EDITOR, Role.SUPER_ADMIN]),
  ContentController.getAll
);

router.post(
  '/admin/content',
  authenticate,
  requireRoles([Role.CONTENT_EDITOR, Role.SUPER_ADMIN]),
  ContentController.create
);

router.patch(
  '/admin/content/:id',
  authenticate,
  requireRoles([Role.CONTENT_EDITOR, Role.SUPER_ADMIN]),
  ContentController.update
);

router.patch(
  '/admin/content/:id/publish',
  authenticate,
  requireRoles([Role.CONTENT_EDITOR, Role.SUPER_ADMIN]),
  ContentController.publish
);

router.patch(
  '/admin/content/:id/unpublish',
  authenticate,
  requireRoles([Role.CONTENT_EDITOR, Role.SUPER_ADMIN]),
  ContentController.unpublish
);

export default router;