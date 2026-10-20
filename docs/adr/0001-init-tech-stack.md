# 1. Architecture Choice: Backend Platform, Containerization, and Deployment

## Context
ShipLens Challenge #01 mandates a reliable branch-to-head-office operational platform with strict deployment, CI/CD, and role access guarantees.

## Decision
1. **Core Stack:** Node.js with TypeScript and Express.js to allow granular middleware control over RBAC and audit logging.
2. **Database:** PostgreSQL accessed via parameterised connection pools (`pg`).
3. **Containerization:** Multi-stage Docker build utilizing `node:20-alpine` executed under an unprivileged user (`appuser`).
4. **CI/CD & Live Host:** GitHub Actions for containerized PostgreSQL testing enforcing a $\ge$60% coverage threshold; Render for cloud hosting connected to Render PostgreSQL.

## Status
Accepted.

## Consequences
- Fast cold-start times on container initialization.
- Type-safe interfaces matching the schema entities developed from Day 2 onwards.