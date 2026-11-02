# ADR 0007: Regional Time Normalization via Asia/Karachi

## Status
Accepted

## Context
Collections logged between 00:00 and 05:00 PKT would shift to the previous calendar day if treated as naive UTC dates, causing boundary mismatches in Monday-to-Sunday weekly audit cycles.

## Decision
- Store all timestamps in UTC (`TIMESTAMPTZ`) in PostgreSQL.
- Perform all operational date boundaries and Monday-to-Sunday calendar week calculations in `Asia/Karachi` standard time.

## Consequences
Maintains uniform audit periods across regional branches regardless of deployment server timezone.
