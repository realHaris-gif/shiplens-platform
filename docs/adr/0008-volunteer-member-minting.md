# ADR 0008: Atomic Sequential Member ID Minting

## Status
Accepted

## Context
When volunteer applications are approved, each new member must receive a human-readable identifier (e.g., `MEM-1017`) without collisions or gaps caused by concurrent HR reviews.

## Decision
- Manage member code generation via an atomic database sequence within an isolated transaction.
- Execute application status transition (`ACCEPTED`) and member record insertion atomically in PostgreSQL.

## Consequences
Guarantees unique, sequentially ordered member identifiers without race conditions.
