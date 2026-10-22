import { Router } from 'express';
import { BranchController } from '../controllers/branch.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Authenticated branch routes
router.get('/branches', authenticate, BranchController.list);

router.post(
  '/branches',
  authenticate,
  requireRoles([Role.SUPER_ADMIN]),
  BranchController.create
);

router.patch(
  '/branches/:id/status',
  authenticate,
  requireRoles([Role.SUPER_ADMIN]),
  BranchController.updateStatus
);

export default router;