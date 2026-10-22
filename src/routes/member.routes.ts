import { Router } from 'express';
import { MemberController } from '../controllers/member.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Public volunteer application submission
router.post('/applications', MemberController.apply);

// Protected routes (HR_LEAD and SUPER_ADMIN)
router.patch(
  '/applications/:id/review',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.HR_LEAD]),
  MemberController.review
);

router.get(
  '/members',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.HR_LEAD, Role.BRANCH_LEAD]),
  MemberController.listMembers
);

export default router;