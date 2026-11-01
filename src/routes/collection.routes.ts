import { Router } from 'express';
import { CollectionController } from '../controllers/collection.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// P0-02: Register /collections/unrouted BEFORE any /collections/:id param routes
router.get(
  '/collections/unrouted',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  CollectionController.listUnrouted
);

// Branch leads log offline physical collections
router.post(
  '/collections',
  authenticate,
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  CollectionController.record
);

// Listing accessible to finance, admin, and branch lead
router.get(
  '/collections',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER, Role.BRANCH_LEAD]),
  CollectionController.list
);

// P0-02: Edit draft collection (restricted to BRANCH_LEAD and SUPER_ADMIN)
router.patch(
  '/collections/:id',
  authenticate,
  requireRoles([Role.BRANCH_LEAD, Role.SUPER_ADMIN]),
  CollectionController.update
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

export default router;