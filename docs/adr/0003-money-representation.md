# 3. Currency Representation and Floating-Point Elimination

## Context
Floating-point arithmetic (e.g., JavaScript `Number` or PostgreSQL `FLOAT`) introduces IEEE 754 precision errors when aggregating collections and generating weekly reports.

## Decision
Store all financial values (offline collections and weekly reports) as signed 64-bit integers (`BIGINT`) representing the smallest currency denomination: Pakistani Paisa (1 PKR = 100 Paisa). 

All calculations in code are executed using integers. Conversions to display strings (e.g., PKR 1,250.50) occur purely at the serialization/view layer.

## Status
Accepted.

## Consequences
- Total protection against precision loss during financial rollups.
- Matches dashboard reconciliation criteria.