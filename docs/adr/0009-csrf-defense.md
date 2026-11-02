# ADR 0009: Stateless CSRF Mitigation via Custom Request Headers

## Status
Accepted

## Context
Browser-managed session cookies are vulnerable to cross-site request forgery when processing state-changing operations (`POST`, `PATCH`, `DELETE`).

## Decision
- Require the custom header `X-Requested-With: ShipLens` on all non-safe HTTP methods when session cookies are used.
- Bypass checks for stateless token-based requests bearing valid `Authorization: Bearer` headers.

## Consequences
Defends against cross-origin ambient credential submission without requiring server-side CSRF session tokens.
