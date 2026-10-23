import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// --- Authentication Endpoints ---
router.post('/auth/login', AuthController.login);
router.post('/login', AuthController.login);

router.post('/auth/logout', AuthController.logout);
router.post('/logout', AuthController.logout);

// --- RBAC Gate Verification Routes ---
router.get(
  '/admin/system-settings',
  authenticate,
  requireRoles([Role.SUPER_ADMIN]),
  (_req, res) => res.status(200).json({ access: 'granted', area: 'SUPER_ADMIN' })
);

router.get(
  '/finance/review-queue',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.FINANCE_REVIEWER]),
  (_req, res) => res.status(200).json({ access: 'granted', area: 'FINANCE' })
);

router.get(
  '/hr/applications',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.HR_LEAD]),
  (_req, res) => res.status(200).json({ access: 'granted', area: 'HR' })
);

router.get(
  '/branch/submit-report',
  authenticate,
  requireRoles([Role.BRANCH_LEAD]),
  (_req, res) => res.status(200).json({ access: 'granted', area: 'BRANCH_LEAD' })
);

router.get(
  '/content/editor',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.CONTENT_EDITOR]),
  (_req, res) => res.status(200).json({ access: 'granted', area: 'CONTENT' })
);

export default router;