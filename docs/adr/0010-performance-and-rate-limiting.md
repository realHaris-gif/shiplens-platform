# ADR 0010: Database Hardening and Denial of Service Protection

## Status
Accepted

## Context
Financial APIs and public submission forms (volunteer applications, contact desk) must be protected against brute force attacks, credential stuffing, and table truncation attacks.

## Decision
- Enforce Express rate limiting on sensitive routes (`/auth/login`, `/contact`, `/applications`).
- Hardened database triggers preventing `TRUNCATE` operations on `audit_logs` and `weekly_reports`.
- Added indexes on `branch_id`, `status`, and date boundaries to optimize dashboard read performance.

## Consequences
Protects service availability and preserves database record integrity under adversarial conditions.
