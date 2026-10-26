# ADR 004: Frozen Operational Metrics Snapshots

## Context
When a weekly report is finalized and approved by a Finance Reviewer, historical reporting metrics must not change even if retrospective adjustments or collection additions occur.

## Decision
Store aggregate financial and activity figures inside an immutable `JSONB` snapshot column (`frozen_metrics`) upon approval, decoupling historical audits from recalculation queries.

## Consequences
- Preserves historical audit integrity across reporting quarters.
- Eliminates discrepancy risks when querying past periods.