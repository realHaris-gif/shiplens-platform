import { Router } from 'express';
import { BranchController } from '../controllers/branch.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);

// Listing branches can be seen by authenticated users
router.get('/branches', BranchController.list);

// Only SUPER_ADMIN can create branches or mutate lifecycle status
router.post('/branches', requireRoles([Role.SUPER_ADMIN]), BranchController.create);
router.patch('/branches/:id/status', requireRoles([Role.SUPER_ADMIN]), BranchController.updateStatus);

export default router;