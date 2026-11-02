# ADR 0006: Centralized Role-Based Access Control Matrix

## Status
Accepted

## Context
Scattering hardcoded role checks across routes introduces security drift, privilege escalation vulnerabilities, and maintenance friction.

## Decision
- Enforce all authorization decisions through a single central permission matrix (`src/config/permissions.ts`).
- Adopt a strict deny-by-default architecture where unmapped routes reject incoming requests with HTTP 403.
- Generate `docs/permissions.md` automatically from code to eliminate documentation desynchronization.

## Consequences
Guarantees consistent access policies across SUPER_ADMIN, FINANCE_REVIEWER, HR_LEAD, BRANCH_LEAD, and CONTENT_EDITOR.
