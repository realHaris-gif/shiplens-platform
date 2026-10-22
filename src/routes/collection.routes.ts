import { Router } from 'express';
import { CollectionController } from '../controllers/collection.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Branch leads log offline physical collections
router.post(
  '/collections',
  authenticate,
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  CollectionController.record
);

// Reviewers and Admins lock and mark transferred
router.patch(
  '/collections/:id/lock',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  CollectionController.lock
);

router.patch(
  '/collections/:id/transfer',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  CollectionController.transfer
);

// Listing accessible to finance, admin, and branch lead
router.get(
  '/collections',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  CollectionController.list
);

export default router;