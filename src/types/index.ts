export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FINANCE_REVIEWER = 'FINANCE_REVIEWER',
  CONTENT_EDITOR = 'CONTENT_EDITOR',
  BRANCH_LEAD = 'BRANCH_LEAD',
  HR_LEAD = 'HR_LEAD',
}

export enum BranchStatus {
  FORMING = 'FORMING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum WeeklyReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  RETURNED = 'RETURNED',
  RESUBMITTED = 'RESUBMITTED',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
}

export interface AuditLogEntry {
  id?: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  record_id: string;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  ip_address?: string | null;
  created_at?: Date;
}