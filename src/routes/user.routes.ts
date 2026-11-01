import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

router.post('/admin/users', authenticate, requireRoles([Role.SUPER_ADMIN]), UserController.createUser);
router.patch('/admin/users/:id/status', authenticate, requireRoles([Role.SUPER_ADMIN]), UserController.setStatus);

export default router;