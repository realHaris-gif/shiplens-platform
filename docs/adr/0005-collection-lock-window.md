# ADR 0005: 7-Day Collection Lock Window and Immutability

## Status
Accepted

## Context
Regional branches handle offline collections that may have minor initial data entry errors. However, ledger entries must become immutable after an operational window to prevent retrospective financial alteration.

## Decision
- Collections remain editable by Branch Leads for up to 7 days (168 hours) after `created_at`.
- Collections automatically lock (`is_locked = TRUE`) upon inclusion in an APPROVED weekly report or after the 7-day window.
- A database-level trigger enforces immutability on locked rows.

## Consequences
Provides branch leads operational flexibility while permanently protecting historical collections.
