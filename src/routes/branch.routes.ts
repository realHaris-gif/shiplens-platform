import { Router } from 'express';
import { BranchController } from '../controllers/branch.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Public: Anyone can list branches to apply
router.get('/branches', BranchController.list);

// Protected: Only SUPER_ADMIN can create or update status
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