import { Router } from 'express';
import { MemberController } from '../controllers/member.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { Role } from '../types';

const router = Router();

// Public volunteer application intake
router.post('/applications', MemberController.apply);

// HR / Super Admin review queue
router.get(
  '/applications',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.HR_LEAD]),
  MemberController.listApplications
);

// Review application (Accept & Mint Member / Decline)
router.patch(
  '/applications/:id/review',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.HR_LEAD]),
  MemberController.reviewApplication
);

// Active members roster
router.get(
  '/members',
  authenticate,
  requireRoles([Role.SUPER_ADMIN, Role.HR_LEAD, Role.BRANCH_LEAD]),
  MemberController.listMembers
);

export default router;