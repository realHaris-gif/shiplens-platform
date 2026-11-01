import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// P0-09: Executive Head Office Dashboard
router.get(
  '/dashboard',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  DashboardController.getSummary
);

export default router;