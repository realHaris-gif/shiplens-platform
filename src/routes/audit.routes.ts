import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

router.get('/admin/audit', authenticate, requireRoles([Role.SUPER_ADMIN]), AuditController.list);

export default router;