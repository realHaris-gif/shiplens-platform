# 2. Append-Only Audit Trail Architecture

## Context
ShipLens Challenge #01 requires an append-only audit trail logging all state transitions. No user (including Super Admin) should be able to edit or delete audit logs. Logs must be recorded transactionally with state modifications.

## Decision
1. Create an `audit_logs` table recording `actor_id`, `action`, `entity_type`, `record_id`, `before_state` (JSONB), `after_state` (JSONB), `ip_address`, and `created_at`.
2. Enforce database-level immutability using a PostgreSQL `BEFORE UPDATE OR DELETE` trigger that raises an uncatchable database exception.
3. Require the `AuditService.log()` invocation to receive an active transaction client (`PoolClient`), ensuring that if the business operation fails, the audit entry rolls back, and vice versa.

## Status
Accepted.

## Consequences
- Guaranteed audit integrity even if administrative SQL access or superuser tokens are compromised.
- Zero drift between recorded entity state and audit timestamps.